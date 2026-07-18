#!/usr/bin/env bun
/**
 * timeman entry point.
 *
 * Commands:
 * - `tm sw`                 Start a stopwatch          (alias: stopwatch)
 * - `tm cd <amount> [unit]` Start a countdown timer    (alias: countdown)
 *
 * `-i/--interactive` switches either command into the full-screen TUI.
 */

import pkg from "../package.json"
import { ansi, drawPanel, style } from "./cli/ansi.ts"

const HELP = `Usage: tm [OPTIONS] COMMAND [ARGS]...

  A terminal based stopwatch and countdown timer.

  Examples:
    tm sw
    tm sw -i
    tm cd 5 m
    tm cd 5 m -i
    tm countdown 10 s

Options:
  -i, --interactive  Run in interactive (TUI) mode.
  -V, --version      Show the version and exit.
  -h, --help         Show this message and exit.

Commands:
  sw  Start a stopwatch. (alias: stopwatch)
  cd  Start a countdown timer. (alias: countdown)`

const SW_HELP = `Usage: tm sw [OPTIONS]

  Start a stopwatch.

  Examples:
    tm sw
    tm sw -p "Project Alpha"
    tm sw -i

Options:
  -p, --project TEXT  Project name to include in the summary.  [default: Untitled]
  -i, --interactive   Run in interactive (TUI) mode.
  -h, --help          Show this message and exit.`

const CD_HELP = `Usage: tm cd [OPTIONS] AMOUNT [UNIT]

  Start a countdown timer.

  Arguments:
    AMOUNT  The amount of time.  [required]
    UNIT    The unit of time. [s]econds, [m]inutes, [h]ours.  [default: m]

  Examples:
    tm cd 5 m
    tm cd 5 m -i
    tm countdown 10 s

Options:
  -i, --interactive  Run in interactive (TUI) mode.
  -h, --help         Show this message and exit.`

const UNIT_SECONDS: Record<string, number> = {
  s: 1, sec: 1, secs: 1, second: 1, seconds: 1,
  m: 60, min: 60, mins: 60, minute: 60, minutes: 60,
  h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600,
}

function die(message: string): never {
  console.error(style(`Error: ${message}`, ansi.red))
  process.exit(1)
}

function usageError(message: string, help: string): never {
  console.error(style(`Error: ${message}`, ansi.red))
  console.error()
  console.error(help)
  process.exit(2)
}

function printErrorBox(message: string): void {
  const panel = drawPanel([style(message, ansi.bold, ansi.red)], {
    title: "Error",
    borderColor: ansi.red,
    paddingY: 0,
    paddingX: 1,
  })
  console.error(panel.join("\n"))
}

function parseCountdownSeconds(amount: number, unit: string): number {
  if (amount <= 0) die("Time must be greater than 0.")
  const normalized = unit.toLowerCase().trim()
  const multiplier = UNIT_SECONDS[normalized]
  if (multiplier === undefined) {
    die(`Unknown unit '${normalized}'. Please use 's', 'm', or 'h'.`)
  }
  const seconds = amount * multiplier
  if (seconds <= 0) die("Time must be greater than 0.")
  return seconds
}

interface ParsedCommand {
  interactive: boolean
  positionals: string[]
  project: string
}

/** Split flags from positionals for a subcommand. */
function parseCommandArgs(args: string[], help: string, allowProject: boolean): ParsedCommand {
  const result: ParsedCommand = { interactive: false, positionals: [], project: "Untitled" }
  let i = 0
  while (i < args.length) {
    const arg = args[i]!
    if (arg === "-i" || arg === "--interactive") {
      result.interactive = true
    } else if (arg === "-h" || arg === "--help") {
      console.log(help)
      process.exit(0)
    } else if (allowProject && (arg === "-p" || arg === "--project")) {
      const value = args[i + 1]
      if (value === undefined) usageError(`Option '${arg}' requires an argument.`, help)
      result.project = value
      i++
    } else if (arg.startsWith("-") && arg !== "-") {
      usageError(`No such option: ${arg}`, help)
    } else {
      result.positionals.push(arg)
    }
    i++
  }
  return result
}

async function runStopwatch(interactive: boolean, project: string): Promise<void> {
  if (interactive) {
    const { runStopwatchTui } = await import("./tui/stopwatch.ts")
    await runStopwatchTui(project)
  } else {
    const { runStopwatchCli } = await import("./cli/stopwatch.ts")
    await runStopwatchCli(project)
  }
}

async function runCountdown(interactive: boolean, seconds: number): Promise<void> {
  if (interactive) {
    const { runCountdownTui } = await import("./tui/countdown.ts")
    await runCountdownTui(seconds)
  } else {
    const { runCountdownCli } = await import("./cli/countdown.ts")
    await runCountdownCli(seconds)
  }
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Global (root-level) options come before the command.
  let rootInteractive = false
  let commandIndex = -1
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === "-V" || arg === "--version") {
      console.log(pkg.version)
      process.exit(0)
    } else if (arg === "-h" || arg === "--help") {
      console.log(HELP)
      process.exit(0)
    } else if (arg === "-i" || arg === "--interactive") {
      rootInteractive = true
    } else if (arg.startsWith("-") && arg !== "-") {
      usageError(`No such option: ${arg}`, HELP)
    } else {
      commandIndex = i
      break
    }
  }

  if (commandIndex === -1) {
    printErrorBox("Missing command.")
    console.log(HELP)
    process.exit(1)
  }

  const command = args[commandIndex]!
  const rest = args.slice(commandIndex + 1)

  switch (command) {
    case "sw":
    case "stopwatch": {
      const parsed = parseCommandArgs(rest, SW_HELP, true)
      if (parsed.positionals.length > 0) {
        usageError(`Got unexpected extra argument (${parsed.positionals[0]})`, SW_HELP)
      }
      await runStopwatch(rootInteractive || parsed.interactive, parsed.project)
      break
    }
    case "cd":
    case "countdown": {
      const parsed = parseCommandArgs(rest, CD_HELP, false)
      const [amountRaw, unitRaw, ...extra] = parsed.positionals
      if (amountRaw === undefined) usageError("Missing argument 'AMOUNT'.", CD_HELP)
      if (extra.length > 0) {
        usageError(`Got unexpected extra argument (${extra[0]})`, CD_HELP)
      }
      if (!/^-?\d+$/.test(amountRaw)) {
        usageError(`Invalid value for 'AMOUNT': '${amountRaw}' is not a valid integer.`, CD_HELP)
      }
      const seconds = parseCountdownSeconds(parseInt(amountRaw, 10), unitRaw ?? "m")
      await runCountdown(rootInteractive || parsed.interactive, seconds)
      break
    }
    default:
      usageError(`No such command '${command}'.`, HELP)
  }

  process.exit(0)
}

main()
