"""time-manager entry point.

Commands:
- `time-manager sw`                 Start a stopwatch
- `tm sw`                           Start a stopwatch
- `tm stopwatch`                    Start a stopwatch
- `time-manager cd <amount> [unit]` Start a countdown timer
- `tm cd <amount> [unit]`           Start a countdown timer
- `tm countdown <amount> [unit]`    Start a countdown timer
"""

from __future__ import annotations

import os

# Terminal emulators differ in how they advertise TrueColor support.
# These defaults help keep Textual/Rich rendering consistent across Windows Terminal,
# VS Code/Cursor terminals, etc. Users can still override by setting these env vars.
os.environ.setdefault("COLORTERM", "truecolor")
os.environ.setdefault("RICH_COLOR_SYSTEM", "truecolor")

from importlib import metadata as _metadata

import typer

from cli import run_countdown_cli, run_stopwatch_cli, print_stopwatch_summary
from tui import CountdownTui, StopwatchTui

_ALIASES: dict[str, str] = {
    "stopwatch": "sw",
    "countdown": "cd",
}


class _TmGroup(typer.core.TyperGroup):
    """Typer group with command aliases (so help doesn't list duplicates)."""

    def get_command(self, ctx: typer.Context, cmd_name: str):
        command = super().get_command(ctx, cmd_name)
        if command is not None:
            return command

        alias = _ALIASES.get(cmd_name)
        if alias is None:
            return None

        return super().get_command(ctx, alias)


# Create the Typer app
app = typer.Typer(
    help=(
        "A terminal based stopwatch and countdown timer.\n\n"
        "Examples:\n"
        "  tm sw\n"
        "  tm sw -i\n"
        "  tm cd 5 m\n"
        "  tm cd 5 m -i\n"
        "  tm countdown 10 s\n"
    ),
    cls=_TmGroup,
    add_completion=False,
)

INTERACTIVE = typer.Option(
    False,
    "--interactive",
    "-i",
    help="Run in interactive (Textual TUI) mode.",
)


def _get_version() -> str:
    for dist_name in ("time-manager", "tm"):
        try:
            return _metadata.version(dist_name)
        except _metadata.PackageNotFoundError:
            continue
    return "unknown"


def _version_callback(value: bool) -> None:
    if not value:
        return
    typer.echo(_get_version())
    raise typer.Exit()


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


def _print_error_box(message: str) -> None:
    """Print an error message in a boxed panel when Rich is available."""
    try:
        from rich import box
        from rich.console import Console
        from rich.panel import Panel
        from rich.text import Text
    except Exception:
        typer.secho(f"Error: {message}", fg=typer.colors.RED, err=True)
        return

    Console(stderr=True).print(
        Panel(
            Text(message, style="bold red"),
            title="Error",
            border_style="red",
            box=box.ROUNDED,
            expand=True,
        )
    )


@app.callback(invoke_without_command=True)
def _root(
    ctx: typer.Context,
    interactive: bool = INTERACTIVE,
    version: bool = typer.Option(
        False,
        "--version",
        "-V",
        help="Show the version and exit.",
        callback=_version_callback,
        is_eager=True,
    ),
) -> None:
    """
    A terminal based stopwatch and countdown timer.
    """
    ctx.ensure_object(dict)
    ctx.obj["interactive"] = interactive

    if ctx.invoked_subcommand is not None:
        return

    # Treat calling `tm` with no command as an error, but show help by default.
    _print_error_box("Missing command.")
    # Use Typer/Click's built-in help so it's complete and stays standard
    # (includes e.g. completion flags and any future global options).
    typer.echo(ctx.get_help())
    raise typer.Exit(code=1)


@app.command(help="Start a stopwatch. (alias: stopwatch)")
def sw(
    ctx: typer.Context,
    interactive: bool = INTERACTIVE,
    name: str = typer.Option(
        "Untitled",
        "--name",
        "-n",
        help="Project name to include in the summary.",
    ),
) -> None:
    """
    Start a stopwatch.

    Examples:
    tm sw
    tm sw -i
    tm stopwatch
    """
    effective_interactive = bool(
        interactive or (ctx.obj or {}).get("interactive", False)
    )
    if effective_interactive:
        stopwatch_tui = StopwatchTui(project_name=name)
        try:
            stopwatch_tui.run()
        finally:
            if stopwatch_tui.stopwatch.is_running:
                stopwatch_tui.stopwatch.stop()
            print_stopwatch_summary(
                name,
                stopwatch_tui.stopwatch.elapsed,
                stopwatch_tui.stopwatch.runs,
            )
    else:
        run_stopwatch_cli(name)


@app.command(help="Start a countdown timer. (alias: countdown)")
def cd(
    ctx: typer.Context,
    amount: int = typer.Argument(..., help="The amount of time."),
    unit: str = typer.Argument(
        "m", help="The unit of time. [s]econds, [m]inutes, [h]ours."
    ),
    interactive: bool = INTERACTIVE,
):
    """
    Start a countdown timer.

    Examples:
    tm cd 5 m
    tm cd 5 m -i
    tm countdown 10 s
    """

    seconds = _parse_countdown_seconds(amount, unit)

    effective_interactive = bool(
        interactive or (ctx.obj or {}).get("interactive", False)
    )
    if effective_interactive:
        CountdownTui(seconds).run()
    else:
        run_countdown_cli(seconds)


def main() -> None:
    app()


if __name__ == "__main__":
    main()
