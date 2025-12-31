import time
import sys
import select
import termios
import tty
from rich.live import Live
from rich.panel import Panel
from rich.text import Text
from rich import box
from core.formatting import format_time
from core.timer import Stopwatch, Countdown


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


def run_stopwatch_cli():
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
                        stopwatch.toggle()
                    elif char.lower() == "r":
                        stopwatch.reset()

                # Update Display
                elapsed = stopwatch.elapsed
                time_str = format_time(elapsed, show_centiseconds=True)

                # Visual feedback for paused state
                style = "bold green" if stopwatch.is_running else "dim green"
                border_style = "green" if stopwatch.is_running else "white"

                panel = Panel(
                    Text(time_str, style=style, justify="center"),
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
