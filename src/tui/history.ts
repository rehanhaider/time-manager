/**
 * History screens for the stopwatch TUI.
 *
 * Two levels. The first rolls every project up over a billing period, because the
 * question this screen exists to answer is "what do I invoice for this period".
 * The second breaks one project into invoice lines, one per day, with the
 * individual sessions underneath for auditing, deleting and renaming.
 */

import { BoxRenderable, TextAttributes, TextRenderable, type KeyEvent } from "@opentui/core"
import type { Database } from "bun:sqlite"
import {
  PERIOD_KEYS,
  type DayGroup,
  type Period,
  type PeriodKey,
  type ProjectTotal,
  deleteSession,
  parseLocalDate,
  periodTotal,
  periodWindow,
  projectDays,
  projectTotals,
  renameProject,
} from "../core/history.ts"
import {
  formatDayHeading,
  formatDurationWords,
  formatHM,
  relativeDayLabel,
} from "../core/formatting.ts"
import type { Hint, Screen } from "./chrome.ts"
import { PALETTE, mix } from "./theme.ts"

const LIST_HINTS: Hint[] = [
  ["↑↓", "project"],
  ["←→", "period"],
  ["enter", "line items"],
  ["esc", "stopwatch"],
  ["q", "quit"],
]

const DAY_HINTS: Hint[] = [
  ["↑↓", "session"],
  ["d", "delete"],
  ["r", "rename"],
  ["esc", "back"],
  ["q", "quit"],
]

const CONFIRM_HINTS: Hint[] = [
  ["y", "delete"],
  ["n", "cancel"],
]

const RENAME_HINTS: Hint[] = [
  ["enter", "save"],
  ["esc", "cancel"],
]

type Mode = "list" | "days" | "confirm" | "rename"

/** A rendered line plus how it should be painted. */
interface Line {
  text: string
  tone: "normal" | "dim" | "strong" | "selected" | "danger"
}

export interface HistoryView {
  open(): void
  close(): void
  readonly isOpen: boolean
  /** True when the key belonged to history and the caller should stop. */
  handleKey(key: KeyEvent): boolean
  layout(width: number, height: number): void
}

export function createHistoryView(
  screen: Screen,
  db: Database,
  onExit: () => void,
): HistoryView {
  const { renderer } = screen

  let open = false
  let mode: Mode = "list"
  let periodIndex = 1 // This Month
  let period: Period = periodWindow(PERIOD_KEYS[periodIndex]!)

  let totals: ProjectTotal[] = []
  let grandTotal = 0
  let projectCursor = 0

  let openProject: string | null = null
  let days: DayGroup[] = []
  let sessionCursor = 0

  let renameBuffer = ""
  let serial = 0

  // Layout, refreshed by the parent's resize handler.
  let termWidth = 80
  let termHeight = 24

  const container = new BoxRenderable(renderer, {
    id: "history",
    flexDirection: "column",
    alignItems: "center",
    visible: false,
  })

  const tabs = new BoxRenderable(renderer, {
    id: "history-tabs",
    flexDirection: "row",
    marginBottom: 1,
  })

  const heading = new TextRenderable(renderer, {
    id: "history-heading",
    content: "",
    fg: PALETTE.cream,
    attributes: TextAttributes.BOLD,
    marginBottom: 1,
  })

  const panel = new BoxRenderable(renderer, {
    id: "history-panel",
    flexDirection: "column",
    border: true,
    borderStyle: "rounded",
    borderColor: mix(PALETTE.gold, 0.35),
    paddingX: 1,
  })

  container.add(tabs)
  container.add(heading)
  container.add(panel)
  screen.content.add(container)

  const clear = (box: BoxRenderable) => {
    for (const child of [...box.getChildren()]) {
      box.remove(child)
      child.destroyRecursively()
    }
  }

  // ------------------------------------------------------------- geometry

  /** Width inside the panel border and padding. */
  const innerWidth = (): number => {
    const budget = Math.max(34, Math.min(termWidth - 8, 70))
    return budget
  }

  /** Rows the panel can show before it needs to scroll. */
  const bodyHeight = (): number => {
    // header row, footer row, tabs, heading, panel border and padding.
    const chrome = tabs.visible ? 8 : 6
    return Math.max(3, termHeight - chrome)
  }

  /** Headings are clipped to the panel so a long project name cannot overhang it. */
  const headingWidth = (): number => innerWidth() + 2

  const showBars = (): boolean => termWidth >= 78
  const showLast = (): boolean => termWidth >= 60

  // ------------------------------------------------------------- painting

  const paint = (lines: Line[]) => {
    clear(panel)
    const generation = serial++
    lines.forEach((line, index) => {
      const row = new TextRenderable(renderer, {
        id: `history-row-${generation}-${index}`,
        content: line.text,
      })
      switch (line.tone) {
        case "dim":
          row.fg = mix(PALETTE.gold, 0.55)
          break
        case "strong":
          row.fg = PALETTE.cream
          row.attributes = TextAttributes.BOLD
          break
        case "selected":
          row.fg = PALETTE.bg
          row.bg = PALETTE.gold
          break
        case "danger":
          row.fg = PALETTE.cream
          row.bg = PALETTE.danger
          break
        default:
          row.fg = PALETTE.gold
      }
      panel.add(row)
    })
  }

  const paintTabs = () => {
    clear(tabs)
    const generation = serial++
    PERIOD_KEYS.forEach((key, index) => {
      const label = periodWindow(key).tab
      const active = index === periodIndex
      const tab = new TextRenderable(renderer, {
        id: `history-tab-${generation}-${key}`,
        content: ` ${label} `,
        fg: active ? PALETTE.bg : mix(PALETTE.gold, 0.55),
        bg: active ? PALETTE.gold : undefined,
        attributes: active ? TextAttributes.BOLD : undefined,
        marginRight: 2,
      })
      tabs.add(tab)
    })
  }

  /** Truncate to a column count, marking the cut. Never pads. */
  const clip = (text: string, width: number): string =>
    width <= 0 ? "" : text.length > width ? text.slice(0, Math.max(0, width - 1)) + "…" : text

  /** Truncate, then pad to an exact column count. */
  const cell = (text: string, width: number, align: "left" | "right" = "left"): string => {
    if (width <= 0) return ""
    const clipped = clip(text, width)
    return align === "left" ? clipped.padEnd(width) : clipped.padStart(width)
  }

  /** Window a row list around the cursor so the selection stays visible. */
  const windowed = <T,>(rows: T[], cursor: number, height: number): T[] => {
    if (rows.length <= height) return rows
    const start = Math.max(0, Math.min(cursor - Math.floor(height / 2), rows.length - height))
    return rows.slice(start, start + height)
  }

  // ------------------------------------------------------------- data load

  const loadList = () => {
    period = periodWindow(PERIOD_KEYS[periodIndex]!)
    totals = projectTotals(db, period)
    grandTotal = periodTotal(db, period)
    if (projectCursor >= totals.length) projectCursor = Math.max(0, totals.length - 1)
  }

  const loadDays = () => {
    if (openProject === null) return
    days = projectDays(db, openProject, period)
    const count = sessionRows().length
    if (sessionCursor >= count) sessionCursor = Math.max(0, count - 1)
  }

  /** Flattened session rows, in the order they appear on screen. */
  const sessionRows = (): Array<{ id: number; day: DayGroup; index: number }> => {
    const rows: Array<{ id: number; day: DayGroup; index: number }> = []
    for (const day of days) {
      day.sessions.forEach((session, index) => {
        rows.push({ id: session.id, day, index })
      })
    }
    return rows
  }

  // ------------------------------------------------------------- renderers

  const renderList = () => {
    screen.setSubtitle("History")
    tabs.visible = termHeight >= 16
    heading.visible = true
    paintTabs()

    if (totals.length === 0) {
      panel.border = false
      heading.content = ""
      heading.visible = false
      paint([{ text: "No sessions yet. Press esc and start the clock.", tone: "dim" }])
      screen.setHints([["esc", "stopwatch"], ["q", "quit"]])
      return
    }

    panel.border = true
    heading.content = clip(
      tabs.visible
        ? `${period.heading}  ·  ${formatDurationWords(grandTotal)} logged`
        : `‹ ${period.tab} · ${formatDurationWords(grandTotal)} ›`,
      headingWidth(),
    )

    const inner = innerWidth()
    const totalCol = 15
    const lastCol = showLast() ? 8 : 0
    const barCol = showBars() ? 22 : 0
    const nameCol = Math.max(10, inner - 2 - totalCol - lastCol - barCol)

    const lines: Line[] = []
    if (showBars()) {
      lines.push({
        text:
          "  " +
          cell("PROJECT", nameCol) +
          cell("SHARE", barCol) +
          cell("TOTAL", totalCol, "right") +
          cell("LAST", lastCol, "right"),
        tone: "dim",
      })
      lines.push({ text: "", tone: "dim" })
    }

    const peak = totals[0]?.seconds ?? 1
    const rows = windowed(totals, projectCursor, bodyHeight() - lines.length)
    const offset = totals.indexOf(rows[0] ?? totals[0]!)

    rows.forEach((row, index) => {
      const selected = offset + index === projectCursor
      const barWidth = barCol > 0 ? Math.max(1, Math.round((row.seconds / peak) * (barCol - 2))) : 0
      lines.push({
        text:
          (selected ? " ▸" : "  ") +
          cell(row.project, nameCol) +
          cell("▬".repeat(barWidth), barCol) +
          cell(formatDurationWords(row.seconds), totalCol, "right") +
          cell(relativeDayLabel(parseLocalDate(row.lastDate)), lastCol, "right"),
        tone: selected ? "selected" : "normal",
      })
    })

    paint(lines)
    screen.setHints(LIST_HINTS)
  }

  const renderDays = () => {
    screen.setSubtitle("History")
    tabs.visible = false
    heading.visible = true
    panel.border = true

    const project = openProject ?? ""
    const total = days.reduce((sum, day) => sum + day.seconds, 0)

    if (mode === "rename") {
      heading.content = clip(`Rename "${project}" to: ${renameBuffer}▏`, headingWidth())
      heading.fg = PALETTE.gold
    } else {
      heading.content = clip(
        `${project}  ·  ${period.tab}  ·  ${formatDurationWords(total)}`,
        headingWidth(),
      )
      heading.fg = PALETTE.cream
    }

    const inner = innerWidth()
    const durCol = 15
    const rows = sessionRows()
    const armedId = mode === "confirm" ? rows[sessionCursor]?.id : undefined

    const lines: Line[] = []
    let flatIndex = 0
    for (const day of days) {
      const label = formatDayHeading(parseLocalDate(day.localDate))
      const subtotal = formatDurationWords(day.seconds)
      const rule = Math.max(1, inner - 2 - label.length - 1 - durCol - 1)
      lines.push({
        text: "  " + label + " " + "─".repeat(rule) + " " + cell(subtotal, durCol, "right"),
        tone: "strong",
      })
      for (const session of day.sessions) {
        const selected = flatIndex === sessionCursor
        const span = `${formatHM(session.started)} → ${formatHM(session.ended)}`
        if (session.id === armedId) {
          lines.push({
            text: cell(` ▸  ${span}      delete this session?  y / n`, inner),
            tone: "danger",
          })
        } else {
          lines.push({
            text:
              (selected ? " ▸  " : "    ") +
              cell(span, Math.max(6, inner - 4 - durCol)) +
              cell(formatDurationWords(session.seconds), durCol, "right"),
            tone: selected ? "selected" : "normal",
          })
        }
        flatIndex++
      }
      lines.push({ text: "", tone: "dim" })
    }
    if (lines.length > 0) lines.pop()

    paint(windowed(lines, sessionCursor, bodyHeight()))
    screen.setHints(
      mode === "confirm" ? CONFIRM_HINTS : mode === "rename" ? RENAME_HINTS : DAY_HINTS,
    )
  }

  const render = () => {
    if (!open) return
    if (mode === "list") renderList()
    else renderDays()
  }

  // ------------------------------------------------------------- keys

  const handleListKey = (key: KeyEvent): boolean => {
    switch (key.name) {
      case "up":
        projectCursor = Math.max(0, projectCursor - 1)
        render()
        return true
      case "down":
        projectCursor = Math.min(Math.max(0, totals.length - 1), projectCursor + 1)
        render()
        return true
      case "left":
        periodIndex = (periodIndex - 1 + PERIOD_KEYS.length) % PERIOD_KEYS.length
        projectCursor = 0
        loadList()
        render()
        return true
      case "right":
        periodIndex = (periodIndex + 1) % PERIOD_KEYS.length
        projectCursor = 0
        loadList()
        render()
        return true
      case "return":
      case "enter": {
        const target = totals[projectCursor]
        if (!target) return true
        openProject = target.project
        sessionCursor = 0
        mode = "days"
        loadDays()
        render()
        return true
      }
      case "escape":
        close()
        onExit()
        return true
      default:
        return false
    }
  }

  const handleDaysKey = (key: KeyEvent): boolean => {
    const rows = sessionRows()
    switch (key.name) {
      case "up":
        sessionCursor = Math.max(0, sessionCursor - 1)
        render()
        return true
      case "down":
        sessionCursor = Math.min(Math.max(0, rows.length - 1), sessionCursor + 1)
        render()
        return true
      case "d":
        if (rows.length > 0) {
          mode = "confirm"
          render()
        }
        return true
      case "r":
        mode = "rename"
        renameBuffer = ""
        render()
        return true
      case "escape":
        mode = "list"
        openProject = null
        loadList()
        render()
        return true
      default:
        return false
    }
  }

  const handleConfirmKey = (key: KeyEvent): boolean => {
    if (key.name === "y") {
      const target = sessionRows()[sessionCursor]
      if (target) deleteSession(db, target.id)
      mode = "days"
      loadDays()
      if (days.length === 0) {
        mode = "list"
        openProject = null
        loadList()
      }
      render()
      return true
    }
    if (key.name === "n" || key.name === "escape") {
      mode = "days"
      render()
      return true
    }
    return true // swallow everything else while armed
  }

  const handleRenameKey = (key: KeyEvent): boolean => {
    if (key.name === "escape") {
      mode = "days"
      render()
      return true
    }
    if (key.name === "return" || key.name === "enter") {
      const next = renameBuffer.trim()
      if (next !== "" && openProject !== null && next !== openProject) {
        renameProject(db, openProject, next)
        openProject = next
        loadDays()
      }
      mode = "days"
      render()
      return true
    }
    if (key.name === "backspace") {
      renameBuffer = renameBuffer.slice(0, -1)
      render()
      return true
    }
    if (key.sequence && key.sequence.length === 1 && key.sequence >= " " && !key.ctrl) {
      if (renameBuffer.length < 48) renameBuffer += key.sequence
      render()
      return true
    }
    return true // never let a keystroke escape into the stopwatch while typing
  }

  const handleKey = (key: KeyEvent): boolean => {
    if (!open) return false
    switch (mode) {
      case "list":
        return handleListKey(key)
      case "days":
        return handleDaysKey(key)
      case "confirm":
        return handleConfirmKey(key)
      case "rename":
        return handleRenameKey(key)
    }
  }

  // ------------------------------------------------------------- lifecycle

  function close(): void {
    open = false
    container.visible = false
  }

  return {
    open() {
      open = true
      mode = "list"
      projectCursor = 0
      container.visible = true
      loadList()
      render()
    },
    close,
    get isOpen() {
      return open
    },
    handleKey,
    layout(width: number, height: number) {
      termWidth = width
      termHeight = height
      render()
    },
  }
}
