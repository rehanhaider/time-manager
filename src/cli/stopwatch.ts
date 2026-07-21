import { Stopwatch } from "../core/termclock.ts"
import { formatStopwatch } from "../core/formatting.ts"
import {
  InlineRegion,
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
      stopResize()
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

      // Below ~8 rows the format hint is the first thing to go.
      const lines = [style(timeStr, ...timeStyle)]
      if (terminalHeight() >= 8) lines.push(style("HH:MM:SS", ansi.dim))

      region.render(
        drawPanel(lines, {
          title: fitText(["Stopwatch", "SW"], terminalWidth() - 6),
          subtitle: fitText(SUBTITLES, terminalWidth() - 6),
          borderColor: running ? ansi.green : ansi.white,
          align: "center",
        }),
      )
    }

    // A resize may have reflowed the frame, so drop it and repaint at the new size.
    const stopResize = onTerminalResize(() => {
      if (finished) return
      region.clear()
      draw()
    })

    draw()
    const timer = setInterval(draw, 1000 / 60)
  })
}
