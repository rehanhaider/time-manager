from textual.app import App, ComposeResult
from textual.containers import Container
from textual.widgets import Header, Footer, Digits, Button, Static
from textual.reactive import reactive
from core.formatting import format_time
from core.termclock import Stopwatch


def _format_stopwatch(seconds: float) -> str:
    """Always format stopwatch as HH:MM:SS"""
    time_str = format_time(seconds, show_centiseconds=False)
    if time_str.count(":") == 1:
        return f"00:{time_str}"
    return time_str


class StopwatchTui(App):
    """A simple stopwatch app."""

    TITLE = "Time Manager"
    SUB_TITLE = "Stopwatch"

    CSS_PATH = "theme.tcss"

    BINDINGS = [
        ("q", "quit", "Quit"),
        ("space", "toggle_timer", "Start/Stop"),
        ("r", "reset_timer", "Reset"),
    ]

    time_elapsed = reactive(0.0)

    def __init__(self, project_name: str | None = None) -> None:
        super().__init__()
        self.stopwatch = Stopwatch()
        self.project_name = (project_name or "").strip() or "Untitled"

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Container(id="content"):
            with Container(id="card-row"):
                with Container(id="display-container"):
                    with Container(id="project-row"):
                        yield Static(
                            f"Project: {self.project_name}", id="project-label"
                        )
                    with Container(id="time-row"):
                        yield Digits("00:00:00", id="time-display")
                    with Container(id="hint-row"):
                        yield Static("HH:MM:SS", id="format-hint")
                    with Container(id="status-row"):
                        yield Static("Ready", id="status", classes="ready")
            with Container(id="buttons-row"):
                with Container(id="buttons"):
                    # Don't use `variant=` here; we want fully deterministic styling via TCSS.
                    yield Button("START", id="start", classes="start", flat=True)
                    yield Button(
                        "STOP", id="stop", classes="stop", disabled=True, flat=True
                    )
                    yield Button("RESET", id="reset", classes="reset", flat=True)
        yield Footer()

    def on_mount(self) -> None:
        self.set_interval(1 / 60, self.update_time)
        self.update_buttons()

    def update_time(self) -> None:
        self.time_elapsed = self.stopwatch.elapsed
        time_str = _format_stopwatch(self.time_elapsed)
        self.query_one("#time-display", Digits).update(time_str)

    def action_toggle_timer(self) -> None:
        if self.stopwatch.is_running:
            self.stopwatch.stop()
        else:
            self.stopwatch.start()
        self.update_buttons()

    def action_reset_timer(self) -> None:
        self._reset_stopwatch()
        self.update_buttons()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "start":
            self.stopwatch.start()
        elif event.button.id == "stop":
            self.stopwatch.stop()
        elif event.button.id == "reset":
            self._reset_stopwatch()

        self.update_buttons()

    def update_buttons(self) -> None:
        running = self.stopwatch.is_running
        if running:
            self.query_one("#start").disabled = True
            self.query_one("#stop").disabled = False
        else:
            self.query_one("#start").disabled = False
            self.query_one("#stop").disabled = True

        status = (
            "Running" if running else ("Ready" if self.time_elapsed == 0 else "Paused")
        )
        status_widget = self.query_one("#status", Static)
        status_widget.update(status)
        status_widget.set_class(running, "running")
        status_widget.set_class((not running) and self.time_elapsed == 0, "ready")
        status_widget.set_class((not running) and self.time_elapsed > 0, "paused")

    def _reset_stopwatch(self) -> None:
        self.stopwatch.reset()
        self.time_elapsed = 0.0
        self.query_one("#time-display", Digits).update("00:00:00")
