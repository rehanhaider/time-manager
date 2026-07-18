import { BoxRenderable, TextAttributes, TextRenderable, type KeyEvent } from "@opentui/core"
import { Stopwatch } from "../core/termclock.ts"
import { formatStopwatch } from "../core/formatting.ts"
import { printStopwatchSummary } from "../cli/summary.ts"
import { Button } from "./button.ts"
import { createScreen } from "./chrome.ts"
import { renderDigits } from "./digits.ts"
import { PALETTE, mix } from "./theme.ts"

/** Full-screen stopwatch TUI (faithful port of the original Textual app). */
export async function runStopwatchTui(projectName?: string): Promise<void> {
  const project = (projectName ?? "").trim() || "Untitled"
  const stopwatch = new Stopwatch()

  const screen = await createScreen("Stopwatch", [
    ["q", "Quit"],
    ["space", "Start/Stop"],
    ["r", "Reset"],
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

  const projectLabel = new TextRenderable(renderer, {
    id: "project-label",
    content: `Project: ${project}`,
    fg: mix(PALETTE.gold, 0.8),
    attributes: TextAttributes.BOLD,
    marginBottom: 1,
  })

  const digits = new TextRenderable(renderer, {
    id: "time-display",
    content: renderDigits("00:00:00"),
    fg: PALETTE.gold,
  })

  const hint = new TextRenderable(renderer, {
    id: "format-hint",
    content: "HH:MM:SS",
    fg: mix(PALETTE.gold, 0.6),
    attributes: TextAttributes.ITALIC,
    marginTop: 1,
  })

  const status = new TextRenderable(renderer, {
    id: "status",
    content: "Ready",
    fg: mix(PALETTE.gold, 0.7),
    attributes: TextAttributes.ITALIC,
    marginTop: 1,
  })

  card.add(projectLabel)
  card.add(digits)
  card.add(hint)
  card.add(status)

  const buttons = new BoxRenderable(renderer, {
    id: "buttons",
    flexDirection: "row",
    marginTop: 2,
  })

  const startButton = new Button(
    renderer,
    "start",
    "START",
    {
      bg: PALETTE.gold,
      fg: PALETTE.bg,
      hoverBg: mix(PALETTE.gold, 0.75),
      hoverFg: PALETTE.danger,
      disabledBg: mix(PALETTE.gold, 0.08),
      disabledFg: mix(PALETTE.gold, 0.45),
    },
    () => {
      stopwatch.start()
      syncState()
    },
  )
  const stopButton = new Button(
    renderer,
    "stop",
    "STOP",
    {
      bg: PALETTE.danger,
      fg: PALETTE.cream,
      hoverBg: mix("#a04545", 0.5),
      hoverFg: PALETTE.cream,
      disabledBg: mix(PALETTE.danger, 0.25),
      disabledFg: mix(PALETTE.cream, 0.55),
    },
    () => {
      stopwatch.stop()
      syncState()
    },
  )
  const resetButton = new Button(
    renderer,
    "reset",
    "RESET",
    {
      bg: mix(PALETTE.gold, 0.15),
      fg: PALETTE.gold,
      hoverBg: mix(PALETTE.gold, 0.25),
      hoverFg: PALETTE.danger,
      disabledBg: mix(PALETTE.gold, 0.08),
      disabledFg: mix(PALETTE.gold, 0.45),
    },
    () => {
      stopwatch.reset()
      syncState()
    },
  )

  buttons.add(startButton.box)
  buttons.add(stopButton.box)
  buttons.add(resetButton.box)

  content.add(card)
  content.add(buttons)

  // Responsive layout: shed spacing first, then the hint, buttons, and project
  // label as the terminal shrinks (keyboard controls always keep working).
  screen.onResize((width, height) => {
    card.paddingY = height >= 24 ? 3 : height >= 19 ? 1 : 0
    card.paddingX = width >= 70 ? 10 : width >= 52 ? 4 : 1
    hint.visible = height >= 19
    buttons.visible = height >= 15
    projectLabel.visible = height >= 11
    buttons.marginTop = height >= 24 ? 2 : 1
    const buttonPad = width >= 76 ? 7 : width >= 58 ? 4 : 2
    for (const button of [startButton, stopButton, resetButton]) {
      button.box.paddingX = buttonPad
    }
  })

  const syncState = () => {
    const running = stopwatch.isRunning
    startButton.setDisabled(running)
    stopButton.setDisabled(!running)

    const elapsed = stopwatch.elapsed
    status.content = running ? "Running" : elapsed === 0 ? "Ready" : "Paused"
    status.fg = mix(PALETTE.gold, running ? 1 : 0.7)
  }

  return new Promise((resolve) => {
    let finished = false

    const quit = () => {
      if (finished) return
      finished = true
      clearInterval(timer)
      screen.cleanup()
      renderer.destroy()
      if (stopwatch.isRunning) stopwatch.stop()
      printStopwatchSummary(project, stopwatch.elapsed, stopwatch.runs)
      resolve()
    }

    renderer.keyInput.on("keypress", (key: KeyEvent) => {
      if (key.name === "q" || (key.ctrl && key.name === "c")) {
        quit()
      } else if (key.name === "space" || key.sequence === " ") {
        stopwatch.toggle()
        syncState()
      } else if (key.name === "r") {
        stopwatch.reset()
        syncState()
      }
    })

    const timer = setInterval(() => {
      digits.content = renderDigits(formatStopwatch(stopwatch.elapsed))
    }, 1000 / 60)

    syncState()
  })
}
