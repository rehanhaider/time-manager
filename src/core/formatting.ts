import type { StopwatchRun } from "./termclock.ts"

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/** Format a duration in seconds as MM:SS(.CC) or HH:MM:SS(.CC). */
export function formatTime(
  seconds: number,
  opts: { showCentiseconds?: boolean } = {},
): string {
  const { showCentiseconds = true } = opts
  const s = Math.max(0, seconds)
  const totalMinutes = Math.floor(s / 60)
  const secs = Math.floor(s % 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (showCentiseconds) {
    const centiseconds = Math.floor((s * 100) % 100)
    if (hours > 0) {
      return `${pad2(hours)}:${pad2(minutes)}:${pad2(secs)}.${pad2(centiseconds)}`
    }
    return `${pad2(minutes)}:${pad2(secs)}.${pad2(centiseconds)}`
  }

  if (hours > 0) return `${pad2(hours)}:${pad2(minutes)}:${pad2(secs)}`
  return `${pad2(minutes)}:${pad2(secs)}`
}

/** Format as HH:MM:SS always (stopwatch display). */
export function formatStopwatch(seconds: number): string {
  const time = formatTime(seconds, { showCentiseconds: false })
  return time.split(":").length === 2 ? `00:${time}` : time
}

/** Format a duration in seconds as 'x hrs y mins'. */
export function formatDurationWords(seconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const hoursLabel = hours === 1 ? "hr" : "hrs"
  const minutesLabel = minutes === 1 ? "min" : "mins"
  return `${hours} ${hoursLabel} ${minutes} ${minutesLabel}`
}

/** Compact clock-drift display: +42s / -3m */
export function formatDriftSeconds(drift: number): string {
  const sign = drift >= 0 ? "+" : "-"
  const abs = Math.abs(drift)
  if (abs < 90) return `${sign}${Math.round(abs)}s`
  return `${sign}${Math.round(abs / 60)}m`
}

/** Local time-zone abbreviation, e.g. "IST", "PST", "GMT+5:30". */
export function localTzName(date: Date = new Date()): string {
  const part = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")
  return part?.value ?? "Local"
}

/** Local wall-clock HH:MM. */
export function formatHM(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** Local wall-clock HH:MM:SS. */
export function formatHMS(date: Date): string {
  return `${formatHM(date)}:${pad2(date.getSeconds())}`
}

export const DRIFT_NOTE =
  "Note: Your system clock changed during this run. " +
  "Session durations use a monotonic clock; displayed start/end times use wall clock."

/** Plain-text timeline of stopwatch runs (no colors). */
export function formatStopwatchTimeline(
  projectName: string,
  totalElapsed: number,
  runs: StopwatchRun[],
): string {
  if (runs.length === 0) return "No runs recorded."

  const now = new Date()
  const tzName = localTzName(now)

  const lines: string[] = []
  lines.push(`  Local time: ${formatHMS(now)} ${tzName}`)
  lines.push("")

  if (runs.some((run) => run.clockDrift !== 0)) {
    lines.push(`  ${DRIFT_NOTE}`)
    lines.push("")
  }

  runs.forEach((run, index) => {
    const startStr = formatHM(run.startTime)
    const endStr = run.endTime ? formatHM(run.endTime) : "..."
    const durationStr = `(${formatDurationWords(run.duration)})`
    const driftStr =
      run.clockDrift !== 0 ? `  Δclock ${formatDriftSeconds(run.clockDrift)}` : ""

    const bar = "▬".repeat(15)
    lines.push(
      `  Session #${index + 1}   ${startStr} ${bar} ${endStr}  ${durationStr}${driftStr}`,
    )
    if (index < runs.length - 1) lines.push("")
  })

  return lines.join("\n")
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

/** Whole days from `from` to `to`, both taken at local midnight. */
function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** Recency for the history list: 'today', a weekday inside the last week, else '29 Aug'. */
export function relativeDayLabel(date: Date, today: Date = new Date()): string {
  const age = daysBetween(date, today)
  if (age === 0) return "today"
  if (age > 0 && age < 7) return WEEKDAYS[date.getDay()]!
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`
}

/** Day header for the line-item view, e.g. 'Mon 01 Sep'. */
export function formatDayHeading(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${pad2(date.getDate())} ${MONTHS_SHORT[date.getMonth()]}`
}
