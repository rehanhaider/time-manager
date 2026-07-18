/**
 * Core stopwatch and countdown logic.
 *
 * Durations are measured with a monotonic clock so they stay correct even if
 * the system (wall) clock jumps — e.g. DST changes, NTP sync, manual changes.
 * Wall-clock timestamps are recorded separately for display, and the
 * difference between the two is surfaced as `clockDrift`.
 */

export const CLOCK_DRIFT_THRESHOLD = 30.0 // seconds

export interface ClockSource {
  /** Monotonic time in seconds. */
  monotonic(): number
  /** Wall-clock time. */
  now(): Date
}

export const systemClock: ClockSource = {
  monotonic: () => performance.now() / 1000,
  now: () => new Date(),
}

export interface StopwatchRun {
  startTime: Date
  endTime: Date | null
  duration: number // seconds, monotonic-based
  startMono: number
  endMono: number
  clockDrift: number // wall delta minus monotonic delta; 0 when below threshold
}

export class Stopwatch {
  private startMono: number | null = null
  private accumulated = 0
  private running = false
  private _runs: StopwatchRun[] = []
  private currentRunStart: Date | null = null

  constructor(private readonly clock: ClockSource = systemClock) {}

  get isRunning(): boolean {
    return this.running
  }

  /** Total elapsed time in seconds. */
  get elapsed(): number {
    if (this.running && this.startMono !== null) {
      return this.accumulated + (this.clock.monotonic() - this.startMono)
    }
    return this.accumulated
  }

  get runs(): StopwatchRun[] {
    return this._runs
  }

  get hasDrift(): boolean {
    return this._runs.some((run) => run.clockDrift !== 0)
  }

  start(): void {
    if (this.running) return
    this.startMono = this.clock.monotonic()
    this.running = true
    this.currentRunStart = this.clock.now()
  }

  stop(): void {
    if (!this.running) return

    const startMono = this.startMono
    const endMono = this.clock.monotonic()
    const endTime = this.clock.now()

    if (startMono === null) {
      this.forceSafeShutdown()
      return
    }

    const elapsedInRun = endMono - startMono

    let wallDelta = 0
    if (this.currentRunStart) {
      wallDelta = (endTime.getTime() - this.currentRunStart.getTime()) / 1000
    }

    let drift = wallDelta - elapsedInRun
    if (Math.abs(drift) < CLOCK_DRIFT_THRESHOLD) drift = 0

    this.accumulated += elapsedInRun

    this._runs.push({
      startTime: this.currentRunStart ?? endTime,
      endTime,
      duration: elapsedInRun,
      startMono,
      endMono,
      clockDrift: drift,
    })

    this.forceSafeShutdown()
  }

  private forceSafeShutdown(): void {
    this.running = false
    this.startMono = null
    this.currentRunStart = null
  }

  /** Forget everything, including any currently running session (no run is recorded). */
  reset(): void {
    this.forceSafeShutdown()
    this.accumulated = 0
    this._runs = []
  }

  toggle(): void {
    if (this.running) this.stop()
    else this.start()
  }
}

export class Countdown {
  private remaining: number
  private lastTick: number | null
  private running = true

  constructor(
    readonly initialSeconds: number,
    private readonly clock: ClockSource = systemClock,
  ) {
    this.remaining = initialSeconds
    this.lastTick = clock.monotonic()
  }

  get timeLeft(): number {
    return Math.max(0, this.remaining)
  }

  get isRunning(): boolean {
    return this.running
  }

  get isFinished(): boolean {
    return this.remaining <= 0
  }

  /** Advance the timer by the real (monotonic) time elapsed since the last tick. */
  tick(): void {
    if (this.running && this.remaining > 0) {
      const now = this.clock.monotonic()
      if (this.lastTick !== null) {
        this.remaining -= now - this.lastTick
      }
      this.lastTick = now
    } else {
      this.lastTick = this.clock.monotonic()
    }
  }

  pause(): void {
    this.running = false
    this.lastTick = null
  }

  resume(): void {
    if (this.running) return
    this.running = true
    this.lastTick = this.clock.monotonic()
  }

  toggle(): void {
    if (this.running) this.pause()
    else this.resume()
  }
}
