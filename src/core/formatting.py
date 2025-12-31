from __future__ import annotations


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
