import {
  BoxRenderable,
  TextAttributes,
  TextRenderable,
  createCliRenderer,
  type CliRenderer,
} from "@opentui/core"
import { formatHMS } from "../core/formatting.ts"
import { PALETTE, mix } from "./theme.ts"

export type Hint = [key: string, label: string]

export interface Screen {
  renderer: CliRenderer
  /** Centered main area between header and footer. */
  content: BoxRenderable
  /** Invoke `cb` with the terminal size now and again on every resize. */
  onResize(cb: (width: number, height: number) => void): void
  /** Replace the footer key hints, for screens that swap their controls. */
  setHints(hints: Hint[]): void
  /** Replace the text after "Time Manager" in the header. */
  setSubtitle(subtitle: string): void
  /** Stop the header clock; call before destroying the renderer. */
  cleanup(): void
}

/**
 * Build the shared screen chrome: header with app title + clock, centered content,
 * footer hints. `existing` lets a harness supply its own renderer.
 */
export async function createScreen(
  subtitle: string,
  hints: Hint[],
  existing?: CliRenderer,
): Promise<Screen> {
  const renderer =
    existing ??
    (await createCliRenderer({
      backgroundColor: PALETTE.bg,
      exitOnCtrlC: false,
      useMouse: true,
      targetFps: 60,
    }))

  const root = new BoxRenderable(renderer, {
    id: "screen",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    backgroundColor: PALETTE.bg,
  })

  // Header like Textual's: icon left, title centered, clock right.
  const header = new BoxRenderable(renderer, {
    id: "header",
    height: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingX: 1,
  })
  header.add(
    new TextRenderable(renderer, {
      id: "header-icon",
      content: "⭘",
      fg: mix(PALETTE.gold, 0.8),
    }),
  )
  const titleZone = new BoxRenderable(renderer, {
    id: "header-title-zone",
    flexGrow: 1,
    flexDirection: "row",
    justifyContent: "center",
  })
  const title = new TextRenderable(renderer, {
    id: "header-title",
    content: `Time Manager — ${subtitle}`,
    fg: PALETTE.gold,
    attributes: TextAttributes.BOLD,
  })
  titleZone.add(title)
  header.add(titleZone)
  const clock = new TextRenderable(renderer, {
    id: "header-clock",
    content: formatHMS(new Date()),
    fg: mix(PALETTE.gold, 0.8),
  })
  header.add(clock)

  const content = new BoxRenderable(renderer, {
    id: "content",
    flexGrow: 1,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  })

  const footer = new BoxRenderable(renderer, {
    id: "footer",
    height: 1,
    flexDirection: "row",
    paddingX: 1,
  })

  let hintSerial = 0
  const fillFooter = (items: Hint[]) => {
    // Ids must stay unique across swaps: the renderer keeps a registry keyed by id.
    const generation = hintSerial++
    for (const [key, label] of items) {
      const hint = new BoxRenderable(renderer, {
        id: `hint-${generation}-${key}`,
        flexDirection: "row",
        marginRight: 2,
      })
      hint.add(
        new TextRenderable(renderer, {
          content: ` ${key} `,
          fg: PALETTE.gold,
          bg: mix(PALETTE.gold, 0.1),
          attributes: TextAttributes.BOLD,
        }),
      )
      hint.add(
        new TextRenderable(renderer, {
          content: ` ${label}`,
          fg: mix(PALETTE.gold, 0.6),
        }),
      )
      footer.add(hint)
    }
  }
  fillFooter(hints)

  root.add(header)
  root.add(content)
  root.add(footer)
  renderer.root.add(root)

  const clockTimer = setInterval(() => {
    clock.content = formatHMS(new Date())
  }, 1000)

  return {
    renderer,
    content,
    onResize: (cb) => {
      cb(renderer.terminalWidth, renderer.terminalHeight)
      renderer.on("resize", (width: number, height: number) => cb(width, height))
    },
    setHints: (items) => {
      for (const child of [...footer.getChildren()]) {
        footer.remove(child)
        child.destroyRecursively()
      }
      fillFooter(items)
    },
    setSubtitle: (next) => {
      title.content = `Time Manager — ${next}`
    },
    cleanup: () => clearInterval(clockTimer),
  }
}
