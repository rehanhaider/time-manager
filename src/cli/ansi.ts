/** Minimal ANSI styling + inline panel rendering for the lightweight CLI mode. */

export const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  blink: "\x1b[5m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h",
} as const

/** Matches an SGR (colour/attribute) escape sequence. */
const SGR = /^\x1b\[[0-9;]*m/

export function style(text: string, ...codes: string[]): string {
  if (codes.length === 0) return text
  return `${codes.join("")}${text}${ansi.reset}`
}

/** Visible width of a string, ignoring ANSI escape sequences. */
export function stringWidth(text: string): number {
  return Bun.stringWidth(text)
}

export function terminalWidth(): number {
  return process.stdout.columns || 80
}

export function terminalHeight(): number {
  return process.stdout.rows || 24
}

/**
 * Widest row we may emit. One column is left spare because a row that exactly
 * fills the terminal wraps on some emulators, which would desync the cursor
 * arithmetic in `InlineRegion`.
 */
function maxRowWidth(): number {
  return Math.max(1, terminalWidth() - 1)
}

/**
 * Clip `text` to `width` visible columns, preserving (and closing) any styling.
 * Every row we print must be at most one terminal row tall, so nothing wraps.
 */
export function truncate(text: string, width: number): string {
  if (width <= 0) return ""
  if (stringWidth(text) <= width) return text

  let out = ""
  let visible = 0
  let styled = false
  let i = 0

  while (i < text.length) {
    if (text[i] === "\x1b") {
      const match = SGR.exec(text.slice(i))
      if (match) {
        out += match[0]
        styled = true
        i += match[0].length
        continue
      }
    }
    const char = text[i]!
    const charWidth = stringWidth(char)
    if (visible + charWidth > width) break
    out += char
    visible += charWidth
    i++
  }

  return styled ? out + ansi.reset : out
}

/** Pick the first variant that fits `width`; returns "" when none do. */
export function fitText(variants: string[], width: number): string {
  for (const variant of variants) {
    if (stringWidth(variant) <= width) return variant
  }
  return ""
}

export interface PanelOptions {
  title?: string
  subtitle?: string
  borderColor?: string
  width?: number
  /** Vertical padding: blank lines above/below the content. Defaults to the terminal height. */
  paddingY?: number
  /** Horizontal padding inside the borders. Defaults to the panel width. */
  paddingX?: number
  /** How content lines sit inside the panel. */
  align?: "left" | "center"
}

/** Center `text` within `width` (visible-width aware). */
export function center(text: string, width: number): string {
  const len = stringWidth(text)
  if (len >= width) return text
  const left = Math.floor((width - len) / 2)
  return " ".repeat(left) + text + " ".repeat(width - len - left)
}

/** A border label only fits if it leaves at least one dash on either side. */
function fitLabel(label: string | undefined, innerWidth: number): string | undefined {
  if (!label) return undefined
  return stringWidth(label) + 4 <= innerWidth ? label : undefined
}

function borderLine(
  left: string,
  right: string,
  label: string | undefined,
  innerWidth: number,
  color: string,
): string {
  if (!label) return style(`${left}${"─".repeat(innerWidth)}${right}`, color)
  const text = ` ${label} `
  const len = stringWidth(text)
  const dashes = Math.max(0, innerWidth - len)
  const before = Math.floor(dashes / 2)
  const after = dashes - before
  return style(`${left}${"─".repeat(before)}${text}${"─".repeat(after)}${right}`, color)
}

/**
 * Draw a rounded panel around the given (possibly ANSI-styled) content lines.
 * Returns the panel as an array of terminal rows.
 *
 * Padding sheds automatically as the terminal shrinks, and border labels are
 * dropped once they no longer fit, so the panel stays intact at any size.
 */
export function drawPanel(lines: string[], opts: PanelOptions = {}): string[] {
  const { title, subtitle, borderColor = "", width = maxRowWidth(), align = "left" } = opts

  // Floors must not fight each other: a row is always exactly innerWidth + 2
  // columns, so clamping innerWidth upward here would overflow a tiny terminal.
  const innerWidth = Math.max(0, width - 2)
  const paddingX = opts.paddingX ?? (innerWidth >= 40 ? 2 : innerWidth >= 20 ? 1 : 0)
  const paddingY = opts.paddingY ?? (terminalHeight() >= 12 ? 1 : 0)
  const contentWidth = Math.max(0, innerWidth - paddingX * 2)

  const bar = style("│", borderColor)
  const padding = " ".repeat(paddingX)

  const rows: string[] = []
  rows.push(borderLine("╭", "╮", fitLabel(title, innerWidth), innerWidth, borderColor))
  const blank = `${bar}${" ".repeat(innerWidth)}${bar}`
  for (let i = 0; i < paddingY; i++) rows.push(blank)
  for (const line of lines) {
    const clipped = truncate(line, contentWidth)
    const body =
      align === "center"
        ? center(clipped, contentWidth)
        : clipped + " ".repeat(Math.max(0, contentWidth - stringWidth(clipped)))
    rows.push(`${bar}${padding}${body}${padding}${bar}`)
  }
  for (let i = 0; i < paddingY; i++) rows.push(blank)
  rows.push(borderLine("╰", "╯", fitLabel(subtitle, innerWidth), innerWidth, borderColor))
  // Below three columns even the borders alone overrun; clip so the returned
  // rows always honour `width`.
  return width < 3 ? rows.map((row) => truncate(row, width)) : rows
}

/**
 * A live, full-screen frame renderer.
 *
 * Drawing happens on the alternate screen buffer, repainted from an absolute
 * origin (`\x1b[H`) every frame. Cursor-relative redrawing cannot be used here:
 * terminals that reflow wrapped lines on resize (Windows Terminal, among
 * others) invalidate any remembered row count, which is what made earlier
 * frames pile up on screen. Absolute repainting has no such state to
 * invalidate, so a resize is just the next frame at a new size.
 *
 * The user's scrollback is untouched — leaving the alternate buffer restores it
 * exactly, so the end-of-session summary still prints inline.
 */
export class LiveScreen {
  private active = false

  start(): void {
    if (this.active || !process.stdout.isTTY) return
    this.active = true
    process.stdout.write(`\x1b[?1049h${ansi.hideCursor}`)
  }

  render(lines: string[]): void {
    if (!this.active) return
    const width = maxRowWidth()
    const height = terminalHeight()

    const rows = lines.slice(0, height).map((line) => truncate(line, width))
    // Vertically centre the frame in the viewport.
    const top = Math.max(0, Math.floor((height - rows.length) / 2))

    const out: string[] = ["\x1b[H"]
    for (let i = 0; i < top; i++) out.push("\x1b[K\r\n")
    rows.forEach((row, index) => {
      out.push(`${row}\x1b[K`)
      // Never emit a newline on the final row: that would scroll the buffer.
      if (top + index < height - 1) out.push("\r\n")
    })
    out.push("\x1b[J")
    process.stdout.write(out.join(""))
  }

  stop(): void {
    if (!this.active) return
    this.active = false
    process.stdout.write(`${ansi.showCursor}\x1b[?1049l`)
  }
}

/** Call `cb` whenever the terminal is resized. Returns an unsubscribe function. */
export function onTerminalResize(cb: () => void): () => void {
  process.stdout.on("resize", cb)
  return () => {
    process.stdout.off("resize", cb)
  }
}

/**
 * Put stdin into raw mode and stream single characters to `onKey`.
 * Returns a restore function.
 */
export function withRawInput(onKey: (key: string) => void): () => void {
  const stdin = process.stdin
  const canRaw = stdin.isTTY
  if (canRaw) stdin.setRawMode(true)
  stdin.resume()
  const handler = (data: Buffer) => {
    for (const ch of data.toString("utf8")) onKey(ch)
  }
  stdin.on("data", handler)
  return () => {
    stdin.off("data", handler)
    if (canRaw) stdin.setRawMode(false)
    stdin.pause()
  }
}
