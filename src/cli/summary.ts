import type { StopwatchRun } from "../core/termclock.ts"
import {
  DRIFT_NOTE,
  formatDriftSeconds,
  formatDurationWords,
  formatHM,
  localTzName,
} from "../core/formatting.ts"
import { ansi, drawPanel, style } from "./ansi.ts"

/** Print the end-of-session stopwatch summary panel (shared by CLI and TUI modes). */
export function printStopwatchSummary(
  projectName: string,
  totalElapsed: number,
  runs: StopwatchRun[],
): void {
  if (runs.length === 0) {
    console.log()
    console.log(style("No runs recorded.", ansi.dim))
    return
  }

  const elapsedText = formatDurationWords(totalElapsed)
  const tzName = localTzName()

  const lines: string[] = []
  if (runs.some((run) => run.clockDrift !== 0)) {
    lines.push(`${style("Note:", ansi.yellow)} ${DRIFT_NOTE.replace(/^Note: /, "")}`)
    lines.push("")
  }

  runs.forEach((run, index) => {
    const startStr = formatHM(run.startTime)
    const endStr = run.endTime ? formatHM(run.endTime) : "..."
    const durationStr = style(`(${formatDurationWords(run.duration)})`, ansi.dim)
    const driftStr =
      run.clockDrift !== 0
        ? " " + style(`Δclock ${formatDriftSeconds(run.clockDrift)}`, ansi.yellow)
        : ""

    const bar = style("▬".repeat(15), ansi.green)
    lines.push(
      `  Session #${index + 1}   ${startStr} ${bar} ${endStr} ${tzName}  ${durationStr}${driftStr}`,
    )
    if (index < runs.length - 1) lines.push("")
  })

  console.log()
  const panel = drawPanel(lines, {
    title: `${projectName}: ${elapsedText}`,
    borderColor: ansi.green,
    paddingY: 0,
    paddingX: 1,
  })
  console.log(panel.join("\n"))
}
