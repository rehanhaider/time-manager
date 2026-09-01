import { Stopwatch } from "../core/termclock.ts"
import { formatStopwatch } from "../core/formatting.ts"
import { recordSessionQuietly } from "../core/history.ts"
import {
  LiveScreen,
  ansi,
  drawPanel,
  fitText,
  onTerminalResize,
  style,
  terminalHeight,
  terminalWidth,
  withRawInput,
} from "./ansi.ts"
import { printStopwatchSummary } from "./summary.ts"

/** Progressively shorter key hints, widest first. */
const SUBTITLES = ["Space: Start/Stop | r: Reset | q: Quit", "space · r · q", "␣ r q"]

/** Lightweight (non-TUI) stopwatch: a live panel with a summary printed on exit. */
export function runStopwatchCli(projectName?: string): Promise<void> {
  const project = (projectName ?? "").trim() || "Untitled"
  const stopwatch = new Stopwatch()
  stopwatch.start()

  const screen = new LiveScreen()
  screen.start()
  // Belt and braces: never strand the terminal on the alternate buffer.
  const restoreScreen = () => screen.stop()
  process.on("exit", restoreScreen)

  return new Promise((resolve) => {
    let finished = false

    const finish = () => {
      if (finished) return
      finished = true
      clearInterval(timer)
      stopResize()
      restoreInput()
      screen.stop()
      process.off("exit", restoreScreen)
      if (stopwatch.isRunning) stopwatch.stop()
      // Recorded here but never read here: history is only readable from the TUI.
      recordSessionQuietly(project, stopwatch.runs)
      printStopwatchSummary(project, stopwatch.elapsed, stopwatch.runs)
      resolve()
    }

    const restoreInput = withRawInput((key) => {
      if (key === "q" || key === "Q" || key === "\x03") {
        finish()
      } else if (key === " ") {
        stopwatch.toggle()
      } else if (key === "r" || key === "R") {
        stopwatch.reset()
      }
    })

    const draw = () => {
      const timeStr = formatStopwatch(stopwatch.elapsed)
      const running = stopwatch.isRunning
      const timeStyle = running ? [ansi.bold, ansi.green] : [ansi.dim, ansi.green]

      // Below ~8 rows the format hint is the first thing to go.
      const lines = [style(timeStr, ...timeStyle)]
      if (terminalHeight() >= 8) lines.push(style("HH:MM:SS", ansi.dim))

      screen.render(
        drawPanel(lines, {
          title: fitText(["Stopwatch", "SW"], terminalWidth() - 6),
          subtitle: fitText(SUBTITLES, terminalWidth() - 6),
          borderColor: running ? ansi.green : ansi.white,
          align: "center",
        }),
      )
    }

    // Repaint immediately on resize rather than waiting for the next tick.
    const stopResize = onTerminalResize(() => {
      if (!finished) draw()
    })

    draw()
    const timer = setInterval(draw, 1000 / 60)
  })
}
