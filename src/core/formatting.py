from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.termclock import StopwatchRun


def format_time(seconds: float, *, show_centiseconds: bool = True) -> str:
    """Format a duration in seconds as MM:SS(.CC) or HH:MM:SS(.CC)."""

    seconds = max(0.0, float(seconds))
    minutes, secs = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)

    if show_centiseconds:
        centiseconds = int((seconds * 100) % 100)
        if hours > 0:
            return f"{int(hours):02}:{int(minutes):02}:{int(secs):02}.{centiseconds:02}"
        return f"{int(minutes):02}:{int(secs):02}.{centiseconds:02}"

    if hours > 0:
        return f"{int(hours):02}:{int(minutes):02}:{int(secs):02}"
    return f"{int(minutes):02}:{int(secs):02}"


def build_stopwatch_summary_fields(
    project_name: str,
    started_at: datetime | None,
    ended_at: datetime | None,
    elapsed: float,
) -> list[tuple[str, str]]:
    clean_name = (project_name or "").strip() or "Untitled"
    start_text = started_at.strftime("%Y-%m-%d %H:%M:%S") if started_at else "N/A"
    end_text = ended_at.strftime("%Y-%m-%d %H:%M:%S") if ended_at else "N/A"

    elapsed_text = format_time(elapsed, show_centiseconds=False)
    if elapsed_text.count(":") == 1:
        elapsed_text = f"00:{elapsed_text}"

    return [
        ("Project name", clean_name),
        ("Start time", start_text),
        ("End time", end_text),
        ("Time elapsed", elapsed_text),
    ]


def format_stopwatch_summary(
    project_name: str,
    started_at: datetime | None,
    ended_at: datetime | None,
    elapsed: float,
) -> str:
    fields = build_stopwatch_summary_fields(
        project_name, started_at, ended_at, elapsed
    )
    return "\n".join(["Summary", *[f"{label}: {value}" for label, value in fields]])


def format_stopwatch_timeline(
    project_name: str, total_elapsed: float, runs: list["StopwatchRun"]
) -> str:
    """Format stopwatch runs as a timeline visualization."""
    if not runs:
        return "No runs recorded."

    lines = []
    for i, run in enumerate(runs, 1):
        start_str = run.start_time.strftime("%H:%M")
        end_str = run.end_time.strftime("%H:%M") if run.end_time else "..."
        duration_str = f"({int(run.duration)}s)"
        
        # Create a simple timeline bar
        bar = "▬" * 15
        line = f"  Session #{i} {start_str} {bar} {end_str}  {duration_str}"
        lines.append(line)

    return "\n".join(lines)
