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

export interface PanelOptions {
  title?: string
  subtitle?: string
  borderColor?: string
  width?: number
  /** Vertical padding: blank lines above/below the content. */
  paddingY?: number
  /** Horizontal padding inside the borders. */
  paddingX?: number
}

/** Center `text` within `width` (visible-width aware). */
export function center(text: string, width: number): string {
  const len = stringWidth(text)
  if (len >= width) return text
  const left = Math.floor((width - len) / 2)
  return " ".repeat(left) + text + " ".repeat(width - len - left)
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
 */
export function drawPanel(lines: string[], opts: PanelOptions = {}): string[] {
  const {
    title,
    subtitle,
    borderColor = "",
    width = terminalWidth(),
    paddingY = 1,
    paddingX = 2,
  } = opts

  const innerWidth = Math.max(4, width - 2)
  const contentWidth = innerWidth - paddingX * 2
  const bar = style("│", borderColor)
  const padding = " ".repeat(paddingX)

  const rows: string[] = []
  rows.push(borderLine("╭", "╮", title, innerWidth, borderColor))
  const blank = `${bar}${" ".repeat(innerWidth)}${bar}`
  for (let i = 0; i < paddingY; i++) rows.push(blank)
  for (const line of lines) {
    const fill = Math.max(0, contentWidth - stringWidth(line))
    rows.push(`${bar}${padding}${line}${" ".repeat(fill)}${padding}${bar}`)
  }
  for (let i = 0; i < paddingY; i++) rows.push(blank)
  rows.push(borderLine("╰", "╯", subtitle, innerWidth, borderColor))
  return rows
}

/** Repeatedly redraw a block of lines in place (like Rich's Live). */
export class InlineRegion {
  private lastHeight = 0

  render(lines: string[]): void {
    const out: string[] = []
    if (this.lastHeight > 0) out.push(`\x1b[${this.lastHeight}A`)
    for (const line of lines) out.push(`\r\x1b[2K${line}\n`)
    if (lines.length < this.lastHeight) {
      const extra = this.lastHeight - lines.length
      for (let i = 0; i < extra; i++) out.push("\r\x1b[2K\n")
      out.push(`\x1b[${extra}A`)
    }
    process.stdout.write(out.join(""))
    this.lastHeight = lines.length
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
