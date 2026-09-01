import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  countSessions,
  deleteSession,
  historyPath,
  localDate,
  openHistory,
  parseLocalDate,
  periodTotal,
  periodWindow,
  projectDays,
  projectTotals,
  pruneToLimit,
  recordSession,
  renameProject,
} from "../src/core/history.ts"
import { formatDayHeading, relativeDayLabel } from "../src/core/formatting.ts"
import type { StopwatchRun } from "../src/core/termclock.ts"

/** Local wall-clock date, so tests do not shift with the runner's time zone. */
function at(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

function run(start: Date, end: Date, seconds: number, drift = 0): StopwatchRun {
  return { startTime: start, endTime: end, duration: seconds, startMono: 0, endMono: seconds, clockDrift: drift }
}

describe("history storage", () => {
  let dir: string
  let db: Database

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "timeman-test-"))
    db = openHistory(join(dir, "history.db"))
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  test("records a session with its runs", () => {
    const id = recordSession(db, "Alpha", [
      run(at(2026, 9, 1, 9, 12), at(2026, 9, 1, 10, 37), 5100),
      run(at(2026, 9, 1, 14, 2), at(2026, 9, 1, 15, 7), 3900),
    ])

    expect(id).not.toBeNull()
    expect(countSessions(db)).toBe(1)

    const session = db.query("SELECT * FROM sessions WHERE id = ?").get(id!) as {
      project: string
      local_date: string
      seconds: number
    }
    expect(session.project).toBe("Alpha")
    expect(session.local_date).toBe("2026-09-01")
    expect(session.seconds).toBe(9000)

    const runCount = db.query("SELECT count(*) AS n FROM runs WHERE session = ?").get(id!) as { n: number }
    expect(runCount.n).toBe(2)
  })

  test("writes nothing when no run was ever stopped", () => {
    expect(recordSession(db, "Alpha", [])).toBeNull()
    expect(countSessions(db)).toBe(0)
    expect(db.query("SELECT count(*) AS n FROM runs").get()).toEqual({ n: 0 })
  })

  test("files a session under the day it started, in local time", () => {
    // 00:30 local. Stored as UTC this would fall on the previous day in any
    // positive offset, and land on the wrong invoice.
    recordSession(db, "Alpha", [run(at(2026, 9, 1, 0, 30), at(2026, 9, 1, 1, 0), 1800)])
    const row = db.query("SELECT local_date FROM sessions").get() as { local_date: string }
    expect(row.local_date).toBe("2026-09-01")
  })

  test("deleting a session takes its runs with it", () => {
    const id = recordSession(db, "Alpha", [run(at(2026, 9, 1, 9, 0), at(2026, 9, 1, 10, 0), 3600)])!
    expect(deleteSession(db, id)).toBe(true)
    expect(countSessions(db)).toBe(0)
    expect(db.query("SELECT count(*) AS n FROM runs").get()).toEqual({ n: 0 })
    expect(deleteSession(db, id)).toBe(false)
  })

  test("renaming moves every session under the old name", () => {
    recordSession(db, "Untitled", [run(at(2026, 9, 1, 9, 0), at(2026, 9, 1, 10, 0), 3600)])
    recordSession(db, "Untitled", [run(at(2026, 9, 2, 9, 0), at(2026, 9, 2, 10, 0), 3600)])
    recordSession(db, "Alpha", [run(at(2026, 9, 2, 11, 0), at(2026, 9, 2, 12, 0), 3600)])

    expect(renameProject(db, "Untitled", "Client Review")).toBe(2)
    const period = periodWindow("month", at(2026, 9, 2))
    expect(projectTotals(db, period).map((t) => t.project).sort()).toEqual(["Alpha", "Client Review"])

    expect(renameProject(db, "Client Review", "   ")).toBe(0)
    expect(renameProject(db, "Client Review", "Client Review")).toBe(0)
  })

  test("prune keeps only the newest rows", () => {
    for (let day = 1; day <= 10; day++) {
      recordSession(db, `P${day}`, [run(at(2026, 9, day, 9, 0), at(2026, 9, day, 10, 0), 3600)])
    }
    expect(pruneToLimit(db, 4)).toBe(6)
    expect(countSessions(db)).toBe(4)
    const kept = db.query("SELECT project FROM sessions ORDER BY id").all() as { project: string }[]
    expect(kept.map((row) => row.project)).toEqual(["P7", "P8", "P9", "P10"])
  })
})

describe("project rollup", () => {
  let dir: string
  let db: Database

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "timeman-test-"))
    db = openHistory(join(dir, "history.db"))
    // August work, then September work.
    recordSession(db, "Alpha", [run(at(2026, 8, 28, 9, 0), at(2026, 8, 28, 11, 0), 7200)])
    recordSession(db, "Alpha", [run(at(2026, 9, 1, 9, 12), at(2026, 9, 1, 10, 37), 5100)])
    recordSession(db, "Alpha", [run(at(2026, 9, 1, 14, 2), at(2026, 9, 1, 15, 7), 3900)])
    recordSession(db, "Beta", [run(at(2026, 9, 1, 16, 0), at(2026, 9, 1, 16, 30), 1800)])
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  test("totals per project, largest first, inside the period", () => {
    const september = periodWindow("month", at(2026, 9, 1))
    const totals = projectTotals(db, september)
    expect(totals).toEqual([
      { project: "Alpha", seconds: 9000, lastDate: "2026-09-01" },
      { project: "Beta", seconds: 1800, lastDate: "2026-09-01" },
    ])
    expect(periodTotal(db, september)).toBe(10800)
  })

  test("last month excludes this month's work", () => {
    const august = periodWindow("lastMonth", at(2026, 9, 1))
    expect(august.from).toBe("2026-08-01")
    expect(august.to).toBe("2026-08-31")
    expect(projectTotals(db, august)).toEqual([
      { project: "Alpha", seconds: 7200, lastDate: "2026-08-28" },
    ])
  })

  test("an empty period totals zero rather than null", () => {
    const july = periodWindow("lastMonth", at(2026, 8, 15))
    expect(projectTotals(db, july)).toEqual([])
    expect(periodTotal(db, july)).toBe(0)
  })

  test("all time spans every period", () => {
    expect(periodTotal(db, periodWindow("all"))).toBe(18000)
  })

  test("line items group into days, newest first, with subtotals", () => {
    const days = projectDays(db, "Alpha", periodWindow("all"))
    expect(days.map((day) => day.localDate)).toEqual(["2026-09-01", "2026-08-28"])
    expect(days[0]!.seconds).toBe(9000)
    expect(days[0]!.sessions).toHaveLength(2)
    expect(days[1]!.seconds).toBe(7200)
    // Newest session first inside a day.
    expect(days[0]!.sessions[0]!.started.getHours()).toBe(14)
  })
})

describe("period windows", () => {
  test("weeks start on Monday", () => {
    // 2026-09-01 is a Tuesday.
    const week = periodWindow("week", at(2026, 9, 1))
    expect(week.from).toBe("2026-08-31")
    expect(week.to).toBe("2026-09-01")
  })

  test("a Monday is its own week start", () => {
    const week = periodWindow("week", at(2026, 8, 31))
    expect(week.from).toBe("2026-08-31")
  })

  test("a Sunday belongs to the week that began six days earlier", () => {
    const week = periodWindow("week", at(2026, 9, 6))
    expect(week.from).toBe("2026-08-31")
  })

  test("last month crosses the year boundary", () => {
    const december = periodWindow("lastMonth", at(2026, 1, 9))
    expect(december.from).toBe("2025-12-01")
    expect(december.to).toBe("2025-12-31")
    expect(december.heading).toBe("December 2025")
  })

  test("february keeps its real length", () => {
    expect(periodWindow("lastMonth", at(2024, 3, 5)).to).toBe("2024-02-29")
    expect(periodWindow("lastMonth", at(2026, 3, 5)).to).toBe("2026-02-28")
  })

  test("month headings name the month", () => {
    expect(periodWindow("month", at(2026, 9, 1)).heading).toBe("September 2026")
  })
})

describe("dates and labels", () => {
  test("local date round trips", () => {
    const date = at(2026, 9, 1, 23, 59)
    expect(localDate(date)).toBe("2026-09-01")
    expect(parseLocalDate("2026-09-01").getDate()).toBe(1)
    expect(parseLocalDate("2026-09-01").getMonth()).toBe(8)
  })

  test("recency reads today, then a weekday, then a date", () => {
    const today = at(2026, 9, 1)
    expect(relativeDayLabel(at(2026, 9, 1), today)).toBe("today")
    expect(relativeDayLabel(at(2026, 8, 28), today)).toBe("Fri")
    expect(relativeDayLabel(at(2026, 8, 20), today)).toBe("20 Aug")
  })

  test("day headings carry the weekday", () => {
    expect(formatDayHeading(at(2026, 9, 1))).toBe("Tue 01 Sep")
    expect(formatDayHeading(at(2026, 8, 30))).toBe("Sun 30 Aug")
  })

  test("TIMEMAN_HOME overrides the data directory", () => {
    const previous = process.env.TIMEMAN_HOME
    process.env.TIMEMAN_HOME = "/tmp/timeman-override"
    expect(historyPath()).toBe("/tmp/timeman-override/history.db")
    if (previous === undefined) delete process.env.TIMEMAN_HOME
    else process.env.TIMEMAN_HOME = previous
  })
})
