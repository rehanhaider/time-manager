import { BoxRenderable, TextAttributes, TextRenderable, type KeyEvent } from "@opentui/core"
import { Countdown } from "../core/termclock.ts"
import { formatTime } from "../core/formatting.ts"
import { createScreen } from "./chrome.ts"
import { renderDigits } from "./digits.ts"
import { PALETTE, mix } from "./theme.ts"

/** Full-screen countdown TUI (faithful port of the original Textual app). */
export async function runCountdownTui(seconds: number): Promise<void> {
  const countdown = new Countdown(seconds)
  let finishedAnnounced = false

  const screen = await createScreen("Countdown", [
    ["q", "Quit"],
    ["space", "Pause/Resume"],
  ])
  const { renderer, content } = screen

  const card = new BoxRenderable(renderer, {
    id: "card",
    flexDirection: "column",
    alignItems: "center",
    border: true,
    borderStyle: "rounded",
    borderColor: mix(PALETTE.gold, 0.2),
    paddingY: 3,
    paddingX: 10,
  })

  const digits = new TextRenderable(renderer, {
    id: "countdown",
    content: renderDigits(formatTime(countdown.timeLeft, { showCentiseconds: false })),
    fg: PALETTE.gold,
  })

  const status = new TextRenderable(renderer, {
    id: "status",
    content: "Running",
    fg: PALETTE.gold,
    attributes: TextAttributes.ITALIC,
    marginTop: 1,
  })

  card.add(digits)
  card.add(status)
  content.add(card)

  // Responsive layout: shrink the card's breathing room as the terminal shrinks.
  screen.onResize((width, height) => {
    card.paddingY = height >= 15 ? 3 : height >= 11 ? 1 : 0
    card.paddingX = width >= 50 ? 10 : width >= 36 ? 4 : 1
  })

  const announceFinished = () => {
    finishedAnnounced = true
    process.stdout.write("\x07") // terminal bell

    // Toast in the top-right corner, like Textual's notify().
    const toast = new BoxRenderable(renderer, {
      id: "toast",
      position: "absolute",
      top: 1,
      right: 2,
      border: true,
      borderStyle: "rounded",
      borderColor: PALETTE.danger,
      backgroundColor: mix(PALETTE.danger, 0.25),
      paddingX: 2,
      zIndex: 10,
    })
    toast.add(
      new TextRenderable(renderer, {
        content: "Time's up!",
        fg: PALETTE.cream,
        attributes: TextAttributes.BOLD,
      }),
    )
    renderer.root.add(toast)
    setTimeout(() => renderer.root.remove(toast), 10_000)
  }

  const sync = () => {
    countdown.tick()
    digits.content = renderDigits(formatTime(countdown.timeLeft, { showCentiseconds: false }))

    const isFinished = countdown.isFinished
    const isPaused = !countdown.isRunning && !isFinished
    const isUrgent = !isPaused && (isFinished || countdown.timeLeft < 10)

    if (isFinished && !finishedAnnounced) announceFinished()

    digits.fg = isUrgent ? PALETTE.danger : isPaused ? mix(PALETTE.gold, 0.7) : PALETTE.gold

    if (isFinished) {
      status.content = "Time's Up!"
      status.fg = PALETTE.danger
    } else if (countdown.isRunning) {
      status.content = "Running"
      status.fg = PALETTE.gold
    } else {
      status.content = "Paused"
      status.fg = mix(PALETTE.gold, 0.7)
    }
  }

  return new Promise((resolve) => {
    let finished = false

    const quit = () => {
      if (finished) return
      finished = true
      clearInterval(timer)
      screen.cleanup()
      renderer.destroy()
      resolve()
    }

    renderer.keyInput.on("keypress", (key: KeyEvent) => {
      if (key.name === "q" || (key.ctrl && key.name === "c")) {
        quit()
      } else if (key.name === "space" || key.sequence === " ") {
        countdown.toggle()
        sync()
      }
    })

    const timer = setInterval(sync, 100)
    sync()
  })
}
