import time
import sys
import select
import termios
import tty
from datetime import datetime
from rich.align import Align
from rich.console import Group
from rich.live import Live
from rich.panel import Panel
from rich.text import Text
from rich import box
from core.formatting import (
    format_time,
    format_stopwatch_timeline,
    format_duration_words,
)
from core.termclock import Stopwatch, Countdown


class NonBlockingInput:
    """Context manager for non-blocking terminal input."""

    def __enter__(self):
        self.old_settings = termios.tcgetattr(sys.stdin)
        tty.setcbreak(sys.stdin.fileno())
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, self.old_settings)

    @staticmethod
    def get_char():
        """Check for and return a character if available, else None."""
        if select.select([sys.stdin], [], [], 0) == ([sys.stdin], [], []):
            return sys.stdin.read(1)
        return None


def run_stopwatch_cli(project_name: str | None = None):
    project_name = (project_name or "").strip() or "Untitled"
    stopwatch = Stopwatch()
    stopwatch.start()

    subtitle = "Space: Start/Stop | r: Reset | q: Quit"

    try:
        with NonBlockingInput(), Live(refresh_per_second=60, screen=False) as live:
            while True:
                # Handle Input
                char = NonBlockingInput.get_char()
                if char:
                    if char.lower() == "q":
                        break
                    elif char == " ":
                        if stopwatch.is_running:
                            stopwatch.stop()
                        else:
                            stopwatch.start()
                    elif char.lower() == "r":
                        stopwatch.reset()

                # Update Display
                elapsed = stopwatch.elapsed
                time_str = format_time(elapsed, show_centiseconds=False)
                # Always display HH:MM:SS (even when hours == 0)
                if time_str.count(":") == 1:
                    time_str = f"00:{time_str}"

                # Visual feedback for paused state
                style = "bold green" if stopwatch.is_running else "dim green"
                border_style = "green" if stopwatch.is_running else "white"

                display = Group(
                    Align.center(Text(time_str, style=style)),
                    Align.center(Text("HH:MM:SS", style="dim")),
                )

                panel = Panel(
                    display,
                    title="Stopwatch",
                    subtitle=subtitle,
                    box=box.ROUNDED,
                    border_style=border_style,
                    padding=(1, 2),
                )
                live.update(panel)
                time.sleep(1 / 60)
    except KeyboardInterrupt:
        pass
    finally:
        if stopwatch.is_running:
            stopwatch.stop()
        print_stopwatch_summary(project_name, stopwatch.elapsed, stopwatch.runs)


def print_stopwatch_summary(
    project_name: str,
    total_elapsed: float,
    runs: list,
) -> None:
    try:
        from rich.console import Console
        from rich.panel import Panel
    except Exception:
        # Fallback to plain text
        print()
        print(f"Project: {project_name}")
        print(f"Total: {format_time(total_elapsed, show_centiseconds=False)}")
        print()
        print(format_stopwatch_timeline(project_name, total_elapsed, runs))
        return

    if not runs:
        print()
        Console().print("[dim]No runs recorded.[/dim]")
        return

    # Format total elapsed time
    elapsed_text = format_duration_words(total_elapsed)

    local_now = datetime.now().astimezone()
    local_tz = local_now.tzinfo
    tz_name = local_now.tzname() or "Local"

    def _to_local(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=local_tz)
        return dt.astimezone(local_tz)

    # Build timeline content with breaks
    timeline_lines = []
    for i, run in enumerate(runs, 1):
        start_str = _to_local(run.start_time).strftime("%H:%M")
        end_str = _to_local(run.end_time).strftime("%H:%M") if run.end_time else "..."
        duration_str = f"({format_duration_words(run.duration)})"

        # Create timeline bar
        bar = "▬" * 15
        line = (
            f"  Session #{i}\t{start_str} [green]{bar}[/green] {end_str} {tz_name}  "
            f"[dim]{duration_str}[/dim]"
        )
        timeline_lines.append(line)

        # Add blank line between runs to show breaks
        if i < len(runs):
            timeline_lines.append("")

    timeline_content = "\n".join(timeline_lines)

    # Create panel with project name and total time in title
    panel = Panel(
        timeline_content,
        title=f"{project_name}: {elapsed_text}",
        border_style="green",
        box=box.ROUNDED,
        padding=(0, 1),
    )

    print()
    Console().print(panel)


def run_countdown_cli(seconds: int):
    countdown = Countdown(seconds)

    subtitle = "Space: Pause/Resume | q: Quit"

    try:
        with NonBlockingInput(), Live(refresh_per_second=10, screen=False) as live:
            while not countdown.is_finished:
                # Handle Input
                char = NonBlockingInput.get_char()
                if char:
                    if char.lower() == "q":
                        break
                    elif char == " ":
                        countdown.toggle()

                countdown.tick()
                remaining = countdown.time_left
                time_str = format_time(remaining, show_centiseconds=False)

                # Change color based on urgency
                color = "blue"
                if remaining < 10:
                    color = "red"
                elif remaining < 30:
                    color = "yellow"

                # Visual feedback for paused state
                style = f"bold {color}" if countdown.is_running else f"dim {color}"
                border_style = color if countdown.is_running else "white"

                panel = Panel(
                    Text(time_str, style=style, justify="center"),
                    title="Countdown",
                    subtitle=subtitle,
                    box=box.ROUNDED,
                    border_style=border_style,
                    padding=(1, 2),
                )
                live.update(panel)
                time.sleep(0.1)

            # Final "Time's Up" display
            if countdown.is_finished:
                panel = Panel(
                    Text("00:00", style="bold red blink", justify="center"),
                    title="Countdown",
                    subtitle="Time's Up!",
                    box=box.ROUNDED,
                    border_style="red",
                    padding=(1, 2),
                )
                live.update(panel)
                time.sleep(2)  # Show for a bit before exiting

    except KeyboardInterrupt:
        pass
