import { Stopwatch } from "../core/termclock.ts"
import { formatStopwatch } from "../core/formatting.ts"
import { InlineRegion, ansi, center, drawPanel, style, terminalWidth, withRawInput } from "./ansi.ts"
import { printStopwatchSummary } from "./summary.ts"

const SUBTITLE = "Space: Start/Stop | r: Reset | q: Quit"

/** Lightweight (non-TUI) stopwatch: a live panel rendered inline in the scrollback. */
export function runStopwatchCli(projectName?: string): Promise<void> {
  const project = (projectName ?? "").trim() || "Untitled"
  const stopwatch = new Stopwatch()
  stopwatch.start()

  const region = new InlineRegion()
  process.stdout.write(ansi.hideCursor)

  return new Promise((resolve) => {
    let finished = false

    const finish = () => {
      if (finished) return
      finished = true
      clearInterval(timer)
      restoreInput()
      process.stdout.write(ansi.showCursor)
      if (stopwatch.isRunning) stopwatch.stop()
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
      const contentWidth = Math.max(4, terminalWidth() - 2) - 4

      region.render(
        drawPanel(
          [
            center(style(timeStr, ...timeStyle), contentWidth),
            center(style("HH:MM:SS", ansi.dim), contentWidth),
          ],
          {
            title: "Stopwatch",
            subtitle: SUBTITLE,
            borderColor: running ? ansi.green : ansi.white,
          },
        ),
      )
    }

    draw()
    const timer = setInterval(draw, 1000 / 60)
  })
}
