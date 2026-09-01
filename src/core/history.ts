/**
 * Persistent stopwatch history.
 *
 * Both stopwatch modes record here on exit; only the TUI reads it back. There is
 * deliberately no CLI command that prints history, so the database path is an
 * implementation detail rather than a public interface.
 *
 * Timestamps are stored as UTC ISO 8601 and rendered in local time on read. The
 * billing day is stored separately as `local_date`, because SQLite normalises an
 * offset to UTC: at +05:30 a session started 00:30 on 1 September would otherwise
 * group under August and land on the wrong invoice.
 */

import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { homedir, platform } from "node:os"
import { dirname, join } from "node:path"
import type { StopwatchRun } from "./termclock.ts"

/** Newest sessions kept. Older rows are dropped after each write. */
export const ROW_LIMIT = 5000

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/** 'YYYY-MM-DD' for a date, in the local time zone. */
export function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Parse 'YYYY-MM-DD' back into local midnight. */
export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

// ---------------------------------------------------------------- periods

export type PeriodKey = "week" | "month" | "lastMonth" | "all"

export const PERIOD_KEYS: readonly PeriodKey[] = ["week", "month", "lastMonth", "all"]

export interface Period {
  key: PeriodKey
  /** Tab label. */
  tab: string
  /** Heading above the table, e.g. "September 2026". */
  heading: string
  /** Inclusive 'YYYY-MM-DD' bounds. */
  from: string
  to: string
}

/** Resolve a period key against a reference date. Weeks start Monday. */
export function periodWindow(key: PeriodKey, now: Date = new Date()): Period {
  const today = localDate(now)
  switch (key) {
    case "week": {
      const sinceMonday = (now.getDay() + 6) % 7
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday)
      const heading = `Week of ${monday.getDate()} ${MONTHS[monday.getMonth()]!.slice(0, 3)}`
      return { key, tab: "This Week", heading, from: localDate(monday), to: today }
    }
    case "month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return {
        key,
        tab: "This Month",
        heading: `${MONTHS[first.getMonth()]} ${first.getFullYear()}`,
        from: localDate(first),
        to: today,
      }
    }
    case "lastMonth": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return {
        key,
        tab: "Last Month",
        heading: `${MONTHS[first.getMonth()]} ${first.getFullYear()}`,
        from: localDate(first),
        to: localDate(last),
      }
    }
    case "all":
      return { key, tab: "All Time", heading: "All time", from: "0000-01-01", to: "9999-12-31" }
  }
}

// ---------------------------------------------------------------- database

function defaultDir(): string {
  const home = homedir()
  if (platform() === "darwin") return join(home, "Library", "Application Support", "timeman")
  if (platform() === "win32") {
    return join(process.env.LOCALAPPDATA ?? join(home, "AppData", "Local"), "timeman")
  }
  return join(process.env.XDG_DATA_HOME ?? join(home, ".local", "share"), "timeman")
}

/** Database location. `TIMEMAN_HOME` overrides the per-platform data directory. */
export function historyPath(): string {
  return join(process.env.TIMEMAN_HOME ?? defaultDir(), "history.db")
}

export function openHistory(path: string = historyPath()): Database {
  mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path, { create: true })
  db.run("PRAGMA journal_mode = WAL")
  db.run("PRAGMA foreign_keys = ON")
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         INTEGER PRIMARY KEY,
      project    TEXT NOT NULL,
      local_date TEXT NOT NULL,
      started    TEXT NOT NULL,
      ended      TEXT NOT NULL,
      seconds    REAL NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS runs (
      session  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      seq      INTEGER NOT NULL,
      started  TEXT NOT NULL,
      ended    TEXT NOT NULL,
      seconds  REAL NOT NULL,
      drift    REAL NOT NULL DEFAULT 0
    )
  `)
  db.run("CREATE INDEX IF NOT EXISTS sessions_date ON sessions(local_date)")
  db.run("CREATE INDEX IF NOT EXISTS sessions_project ON sessions(project)")
  db.run("CREATE INDEX IF NOT EXISTS runs_session ON runs(session)")
  return db
}

// ---------------------------------------------------------------- writing

/**
 * Record one stopwatch session. Returns the new row id, or null when the
 * stopwatch was never stopped on a run (nothing worth billing happened).
 */
export function recordSession(
  db: Database,
  project: string,
  runs: StopwatchRun[],
): number | null {
  const finished = runs.filter((run) => run.endTime !== null)
  if (finished.length === 0) return null

  const started = finished[0]!.startTime
  const ended = finished[finished.length - 1]!.endTime!
  const seconds = finished.reduce((total, run) => total + run.duration, 0)

  const write = db.transaction(() => {
    const row = db
      .query<{ id: number }, [string, string, string, string, number]>(
        `INSERT INTO sessions (project, local_date, started, ended, seconds)
         VALUES (?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(project, localDate(started), started.toISOString(), ended.toISOString(), seconds)
    const id = row!.id
    const insertRun = db.query(
      `INSERT INTO runs (session, seq, started, ended, seconds, drift)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    finished.forEach((run, index) => {
      insertRun.run(
        id,
        index + 1,
        run.startTime.toISOString(),
        run.endTime!.toISOString(),
        run.duration,
        run.clockDrift,
      )
    })
    return id
  })

  const id = write()
  pruneToLimit(db)
  return id
}

/**
 * Drop everything but the newest `limit` sessions, returning how many sessions
 * went. The driver's own `changes` count includes rows the foreign key cascade
 * removed from `runs`, so it is not the number a caller means here.
 */
export function pruneToLimit(db: Database, limit: number = ROW_LIMIT): number {
  const before = countSessions(db)
  db.run(
    `DELETE FROM sessions
      WHERE id NOT IN (SELECT id FROM sessions ORDER BY id DESC LIMIT ?)`,
    [limit],
  )
  return before - countSessions(db)
}

export function deleteSession(db: Database, id: number): boolean {
  return db.run("DELETE FROM sessions WHERE id = ?", [id]).changes > 0
}

/** Retitle every session filed under `from`. Returns the number of rows moved. */
export function renameProject(db: Database, from: string, to: string): number {
  const name = to.trim()
  if (name === "" || name === from) return 0
  return db.run("UPDATE sessions SET project = ? WHERE project = ?", [name, from]).changes
}

export function countSessions(db: Database): number {
  return db.query<{ n: number }, []>("SELECT count(*) AS n FROM sessions").get()!.n
}

// ---------------------------------------------------------------- reading

export interface ProjectTotal {
  project: string
  seconds: number
  /** 'YYYY-MM-DD' of the most recent session inside the period. */
  lastDate: string
}

/** Screen one: every project in the period, largest total first. */
export function projectTotals(db: Database, period: Period): ProjectTotal[] {
  return db
    .query<ProjectTotal, [string, string]>(
      `SELECT project, SUM(seconds) AS seconds, MAX(local_date) AS lastDate
         FROM sessions
        WHERE local_date BETWEEN ? AND ?
        GROUP BY project
        ORDER BY seconds DESC, project ASC`,
    )
    .all(period.from, period.to)
}

export function periodTotal(db: Database, period: Period): number {
  const row = db
    .query<{ seconds: number | null }, [string, string]>(
      "SELECT SUM(seconds) AS seconds FROM sessions WHERE local_date BETWEEN ? AND ?",
    )
    .get(period.from, period.to)
  return row?.seconds ?? 0
}

export interface SessionLine {
  id: number
  started: Date
  ended: Date
  seconds: number
}

export interface DayGroup {
  localDate: string
  seconds: number
  sessions: SessionLine[]
}

/** Screen two: one project's sessions, newest day first, grouped into invoice lines. */
export function projectDays(db: Database, project: string, period: Period): DayGroup[] {
  const rows = db
    .query<
      { id: number; localDate: string; started: string; ended: string; seconds: number },
      [string, string, string]
    >(
      `SELECT id, local_date AS localDate, started, ended, seconds
         FROM sessions
        WHERE project = ? AND local_date BETWEEN ? AND ?
        ORDER BY local_date DESC, started DESC`,
    )
    .all(project, period.from, period.to)

  const groups: DayGroup[] = []
  for (const row of rows) {
    let group = groups[groups.length - 1]
    if (!group || group.localDate !== row.localDate) {
      group = { localDate: row.localDate, seconds: 0, sessions: [] }
      groups.push(group)
    }
    group.seconds += row.seconds
    group.sessions.push({
      id: row.id,
      started: new Date(row.started),
      ended: new Date(row.ended),
      seconds: row.seconds,
    })
  }
  return groups
}

/**
 * Open, record and close in one call, swallowing any failure.
 *
 * Both stopwatch modes call this as they exit. A database that cannot be opened
 * (read-only home, full disk) must not cost the user the summary panel they just
 * earned, so history is best effort and the panel is the contract.
 */
export function recordSessionQuietly(project: string, runs: StopwatchRun[]): void {
  let db: Database | null = null
  try {
    db = openHistory()
    recordSession(db, project, runs)
  } catch {
    return
  } finally {
    db?.close()
  }
}
