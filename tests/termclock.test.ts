import { describe, expect, test } from "bun:test"
import {
  Countdown,
  Stopwatch,
  type ClockSource,
} from "../src/core/termclock.ts"
import {
  formatDurationWords,
  formatStopwatch,
  formatTime,
} from "../src/core/formatting.ts"

/** Clock stub with scripted monotonic values and wall-clock times. */
function fakeClock(monotonicValues: number[], wallTimes: Date[]): ClockSource {
  const monos = [...monotonicValues]
  const walls = [...wallTimes]
  return {
    monotonic: () => {
      const value = monos.shift()
      if (value === undefined) throw new Error("No fake monotonic values left")
      return value
    },
    now: () => {
      const value = walls.shift()
      if (value === undefined) throw new Error("No fake wall times left")
      return value
    },
  }
}

describe("Stopwatch clock behavior", () => {
  test("duration uses monotonic clock even if wall clock jumps", () => {
    // Wall clock advances 70 minutes, monotonic only 10 minutes.
    const wallStart = new Date(Date.UTC(2026, 2, 9, 13, 53))
    const wallEnd = new Date(wallStart.getTime() + 70 * 60 * 1000)

    const sw = new Stopwatch(fakeClock([1000, 1600], [wallStart, wallEnd]))
    sw.start()
    sw.stop()

    expect(sw.runs).toHaveLength(1)
    const run = sw.runs[0]!
    expect(run.duration).toBeCloseTo(600, 6)
    // Drift = wall delta - monotonic delta = 4200 - 600 = +3600 seconds.
    expect(run.clockDrift).toBeCloseTo(3600, 6)
    expect(sw.isRunning).toBe(false)
    expect(sw.elapsed).toBeCloseTo(600, 6)
    expect(sw.hasDrift).toBe(true)
  })

  test("drift below threshold is reported as zero", () => {
    const wallStart = new Date(Date.UTC(2026, 2, 9, 13, 53))
    // Wall advances 610s vs monotonic 600s: 10s drift, below the 30s threshold.
    const wallEnd = new Date(wallStart.getTime() + 610 * 1000)

    const sw = new Stopwatch(fakeClock([1000, 1600], [wallStart, wallEnd]))
    sw.start()
    sw.stop()

    expect(sw.runs[0]!.clockDrift).toBe(0)
    expect(sw.hasDrift).toBe(false)
  })

  test("reset while running does not record a run", () => {
    const wallStart = new Date(Date.UTC(2026, 2, 9, 13, 53))
    const sw = new Stopwatch(fakeClock([500, 800], [wallStart]))
    sw.start()
    void sw.elapsed // computed from monotonic, but reset should forget everything
    sw.reset()

    expect(sw.isRunning).toBe(false)
    expect(sw.elapsed).toBe(0)
    expect(sw.runs).toEqual([])
  })

  test("stop shuts down safely when internal start is missing", () => {
    const sw = new Stopwatch(fakeClock([123], [new Date()]))
    // Corrupt internal state: running but no recorded start.
    ;(sw as any).running = true
    ;(sw as any).startMono = null
    sw.stop()

    expect(sw.isRunning).toBe(false)
    expect(sw.runs).toEqual([])
  })

  test("accumulates across multiple runs", () => {
    const wall = new Date(Date.UTC(2026, 2, 9, 13, 0))
    const walls = [0, 100, 200, 300].map(
      (s) => new Date(wall.getTime() + s * 1000),
    )
    // Run 1: 100 → 200 (100s). Run 2: 300 → 400 (100s).
    const sw = new Stopwatch(fakeClock([100, 200, 300, 400], walls))
    sw.start()
    sw.stop()
    sw.start()
    sw.stop()

    expect(sw.runs).toHaveLength(2)
    expect(sw.elapsed).toBeCloseTo(200, 6)
  })
})

describe("Countdown", () => {
  test("ticks down by monotonic deltas and finishes", () => {
    const cd = new Countdown(10, fakeClock([0, 4, 10.5], [])) // constructor + 2 ticks
    expect(cd.timeLeft).toBe(10)
    cd.tick() // +4s elapsed → 6 left
    expect(cd.timeLeft).toBeCloseTo(6, 6)
    expect(cd.isFinished).toBe(false)
    cd.tick() // +6.5s elapsed → -0.5 → finished, timeLeft clamps to 0
    expect(cd.timeLeft).toBe(0)
    expect(cd.isFinished).toBe(true)
  })

  test("pause stops time from draining", () => {
    const cd = new Countdown(10, fakeClock([0, 5, 100, 100, 101], []))
    cd.tick() // 5s elapsed → 5 left
    cd.pause()
    cd.tick() // paused: refreshes lastTick (mono 100), drains nothing
    expect(cd.timeLeft).toBeCloseTo(5, 6)
    cd.resume() // lastTick = 100
    cd.tick() // +1s → 4 left
    expect(cd.timeLeft).toBeCloseTo(4, 6)
  })

  test("toggle flips between paused and running", () => {
    const cd = new Countdown(10, fakeClock([0, 50], []))
    expect(cd.isRunning).toBe(true)
    cd.toggle()
    expect(cd.isRunning).toBe(false)
    cd.toggle()
    expect(cd.isRunning).toBe(true)
  })
})

describe("formatting", () => {
  test("formatTime", () => {
    expect(formatTime(0)).toBe("00:00.00")
    expect(formatTime(65.25)).toBe("01:05.25")
    expect(formatTime(3661, { showCentiseconds: false })).toBe("01:01:01")
    expect(formatTime(59.999, { showCentiseconds: false })).toBe("00:59")
    expect(formatTime(-5)).toBe("00:00.00")
  })

  test("formatStopwatch always shows hours", () => {
    expect(formatStopwatch(0)).toBe("00:00:00")
    expect(formatStopwatch(65)).toBe("00:01:05")
    expect(formatStopwatch(3661)).toBe("01:01:01")
  })

  test("formatDurationWords", () => {
    expect(formatDurationWords(0)).toBe("0 hrs 0 mins")
    expect(formatDurationWords(60)).toBe("0 hrs 1 min")
    expect(formatDurationWords(3600)).toBe("1 hr 0 mins")
    expect(formatDurationWords(3720)).toBe("1 hr 2 mins")
    expect(formatDurationWords(7320)).toBe("2 hrs 2 mins")
  })
})
