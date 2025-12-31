"""Timer entry point.

Commands:
- `timer sw`                 Start a stopwatch
- `timer cd <amount> [unit]` Start a countdown timer
"""

from __future__ import annotations

import os

# Terminal emulators differ in how they advertise TrueColor support.
# These defaults help keep Textual/Rich rendering consistent across Windows Terminal,
# VS Code/Cursor terminals, etc. Users can still override by setting these env vars.
os.environ.setdefault("COLORTERM", "truecolor")
os.environ.setdefault("RICH_COLOR_SYSTEM", "truecolor")

import typer

from cli import run_countdown_cli, run_stopwatch_cli
from tui import CountdownTui, StopwatchTui

# Create the Typer app
app = typer.Typer(help="A CLI based timer using Textual.")

CLI_MODE = typer.Option(False, "--cli", help="Run in CLI mode instead of TUI.")

_UNIT_SECONDS: dict[str, int] = {
    # seconds
    "s": 1,
    "sec": 1,
    "secs": 1,
    "second": 1,
    "seconds": 1,
    # minutes
    "m": 60,
    "min": 60,
    "mins": 60,
    "minute": 60,
    "minutes": 60,
    # hours
    "h": 3600,
    "hr": 3600,
    "hrs": 3600,
    "hour": 3600,
    "hours": 3600,
}


def _die(message: str) -> None:
    typer.secho(f"Error: {message}", fg=typer.colors.RED, err=True)
    raise typer.Exit(code=1)


def _parse_countdown_seconds(amount: int, unit: str) -> int:
    if amount <= 0:
        _die("Time must be greater than 0.")

    normalized_unit = unit.lower().strip()
    multiplier = _UNIT_SECONDS.get(normalized_unit)
    if multiplier is None:
        _die(f"Unknown unit '{normalized_unit}'. Please use 's', 'm', or 'h'.")

    seconds = amount * multiplier
    if seconds <= 0:
        _die("Time must be greater than 0.")

    return seconds


@app.command()
def sw(cli: bool = CLI_MODE) -> None:
    """
    Start a stopwatch.
    """
    if cli:
        run_stopwatch_cli()
    else:
        StopwatchTui().run()


@app.command()
def cd(
    amount: int = typer.Argument(..., help="The amount of time."),
    unit: str = typer.Argument(
        "m", help="The unit of time. [s]econds, [m]inutes, [h]ours."
    ),
    cli: bool = CLI_MODE,
):
    """
    Start a countdown timer.

    Example:
    timer cd 5 m
    timer cd 60 s
    timer cd 1 h
    """

    seconds = _parse_countdown_seconds(amount, unit)

    if cli:
        run_countdown_cli(seconds)
    else:
        CountdownTui(seconds).run()


def main() -> None:
    app()


if __name__ == "__main__":
    main()
