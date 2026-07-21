import type { StopwatchRun } from "../core/termclock.ts"
import {
  DRIFT_NOTE,
  formatDriftSeconds,
  formatDurationWords,
  formatHM,
  localTzName,
} from "../core/formatting.ts"
import { ansi, drawPanel, fitText, style, terminalWidth } from "./ansi.ts"

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

  // Width available between the borders, matching drawPanel's own arithmetic
  // below (1 spare column, 2 borders, paddingX of 1 on each side).
  const contentWidth = Math.max(1, terminalWidth() - 1 - 2 - 2)

  runs.forEach((run, index) => {
    const startStr = formatHM(run.startTime)
    const endStr = run.endTime ? formatHM(run.endTime) : "..."
    const durationStr = style(`(${formatDurationWords(run.duration)})`, ansi.dim)
    const driftStr =
      run.clockDrift !== 0
        ? " " + style(`Δclock ${formatDriftSeconds(run.clockDrift)}`, ansi.yellow)
        : ""

    // Shed the bar, then the timezone, then the label padding as space runs out.
    const bar = (n: number) => style("▬".repeat(n), ansi.green)
    const line = fitText(
      [
        `  Session #${index + 1}   ${startStr} ${bar(15)} ${endStr} ${tzName}  ${durationStr}${driftStr}`,
        `  Session #${index + 1}   ${startStr} ${bar(6)} ${endStr} ${tzName}  ${durationStr}${driftStr}`,
        `  Session #${index + 1}   ${startStr} → ${endStr}  ${durationStr}${driftStr}`,
        `  #${index + 1} ${startStr}→${endStr} ${durationStr}`,
        `  #${index + 1} ${startStr}→${endStr}`,
      ],
      contentWidth,
    )
    // Nothing fit on one row: stack the essentials instead of truncating them.
    if (line) {
      lines.push(line)
    } else {
      lines.push(`#${index + 1} ${startStr}`)
      lines.push(`  → ${endStr}`)
    }
    if (index < runs.length - 1) lines.push("")
  })

  console.log()
  const panel = drawPanel(lines, {
    title: fitText([`${projectName}: ${elapsedText}`, elapsedText], Math.max(0, contentWidth - 2)),
    borderColor: ansi.green,
    paddingY: 0,
    paddingX: 1,
  })
  console.log(panel.join("\n"))
}
