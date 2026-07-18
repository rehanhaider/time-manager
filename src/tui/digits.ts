/**
 * Textual's 3x3 unicode digit font (the `Digits` widget), reproduced exactly —
 * glyph data taken verbatim from textual.renderables.digits.DIGITS3X3.
 * Each character occupies a 3-column cell across 3 rows.
 */

const GLYPHS: Record<string, [string, string, string]> = {
  " ": ["", "", ""],
  "0": ["╭─╮", "│ │", "╰─╯"],
  "1": ["╶╮", " │", "╶┴╴"],
  "2": ["╶─╮", "┌─┘", "╰─╴"],
  "3": ["╶─╮", " ─┤", "╶─╯"],
  "4": ["╷ ╷", "╰─┤", "  ╵"],
  "5": ["╭─╴", "╰─╮", "╶─╯"],
  "6": ["╭─╴", "├─╮", "╰─╯"],
  "7": ["╶─┐", "  │", "  ╵"],
  "8": ["╭─╮", "├─┤", "╰─╯"],
  "9": ["╭─╮", "╰─┤", "╶─╯"],
  ":": ["", " :", ""],
  "+": ["", "╶┼╴", ""],
  "-": ["", "╶─╴", ""],
}

/**
 * Render text in the 3-row digit font, mirroring Textual's algorithm:
 * known glyphs are left-justified into 3-column cells; unknown characters
 * render as-is on the bottom row ("." becomes a bullet, like Textual).
 */
export function renderDigits(text: string): string {
  const rows: [string, string, string] = ["", "", ""]
  for (const char of text.replace(/\./g, "•")) {
    const glyph = GLYPHS[char]
    if (glyph) {
      rows[0] += glyph[0].padEnd(3)
      rows[1] += glyph[1].padEnd(3)
      rows[2] += glyph[2].padEnd(3)
    } else {
      rows[0] += " "
      rows[1] += " "
      rows[2] += char
    }
  }
  return rows.join("\n")
}
