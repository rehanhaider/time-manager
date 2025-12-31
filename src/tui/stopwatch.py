from textual.app import App, ComposeResult
from textual.containers import Container
from textual.widgets import Header, Footer, Digits, Button, Static
from textual.reactive import reactive
from core.formatting import format_time
from core.timer import Stopwatch
from tui.theme import TIMER_CSS, MUTED, SECONDARY


class StopwatchTui(App):
    """A simple stopwatch app."""

    TITLE = "Timer"
    SUB_TITLE = "Stopwatch"

    CSS = TIMER_CSS

    BINDINGS = [
        ("q", "quit", "Quit"),
        ("space", "toggle_timer", "Start/Stop"),
        ("r", "reset_timer", "Reset"),
    ]

    time_elapsed = reactive(0.0)

    def __init__(self) -> None:
        super().__init__()
        self.stopwatch = Stopwatch()

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Container(id="content"):
            with Container(id="display-container"):
                yield Digits("00:00.00", id="time-display")
                yield Static("Ready", id="status")
            with Container(id="buttons"):
                # Don't use `variant=` here; we want fully deterministic styling via TCSS.
                yield Button("START", id="start", classes="start")
                yield Button("STOP", id="stop", classes="stop", disabled=True)
                yield Button("RESET", id="reset", classes="reset")
        yield Footer()

    def on_mount(self) -> None:
        self.set_interval(1 / 60, self.update_time)
        self.update_buttons()

    def update_time(self) -> None:
        self.time_elapsed = self.stopwatch.elapsed
        time_str = format_time(self.time_elapsed, show_centiseconds=True)
        self.query_one("#time-display", Digits).update(time_str)

    def action_toggle_timer(self) -> None:
        self.stopwatch.toggle()
        self.update_buttons()

    def action_reset_timer(self) -> None:
        self.stopwatch.reset()
        self.time_elapsed = 0.0
        self.query_one("#time-display", Digits).update("00:00.00")
        self.update_buttons()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "start":
            self.stopwatch.start()
        elif event.button.id == "stop":
            self.stopwatch.stop()
        elif event.button.id == "reset":
            self.stopwatch.reset()
            self.time_elapsed = 0.0
            self.query_one("#time-display", Digits).update("00:00.00")

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
        status_widget.styles.color = SECONDARY if running else MUTED
