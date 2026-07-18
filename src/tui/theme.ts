/** Shared palette for the TUI screens (ported from theme.tcss). */

export const PALETTE = {
  bg: "#081e32",
  gold: "#d5b77c",
  danger: "#8b3a3a",
  cream: "#fffaf0",
} as const

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "")
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ]
}

/**
 * Blend `fg` over `bg` at the given opacity — emulates Textual's
 * `color: #d5b77c 60%` alpha styling on terminals without alpha support.
 */
export function mix(fg: string, alpha: number, bg: string = PALETTE.bg): string {
  const [fr, fgc, fb] = hexToRgb(fg)
  const [br, bgc, bb] = hexToRgb(bg)
  const channel = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha))
  const toHex = (n: number) => n.toString(16).padStart(2, "0")
  return `#${toHex(channel(fr, br))}${toHex(channel(fgc, bgc))}${toHex(channel(fb, bb))}`
}
