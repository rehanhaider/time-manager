from textual.app import App, ComposeResult
from textual.containers import Container
from textual.widgets import Digits, Footer, Header, Static
from textual.reactive import reactive
from core.formatting import format_time
from core.termclock import Countdown


class CountdownTui(App):
    """A countdown timer app."""

    TITLE = "Time Manager"
    SUB_TITLE = "Countdown"

    CSS_PATH = "theme.tcss"

    BINDINGS = [
        ("q", "quit", "Quit"),
        ("space", "toggle_pause", "Pause/Resume"),
    ]

    time_left = reactive(0.0)

    def __init__(self, seconds: int) -> None:
        super().__init__()
        self.countdown = Countdown(seconds)
        self._finished_announced = False

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Container(id="content"):
            with Container(id="card-row"):
                with Container(id="display-container"):
                    with Container(id="time-row"):
                        yield Digits("00:00", id="countdown")
                    with Container(id="status-row"):
                        yield Static("Running", id="status", classes="running")
        yield Footer()

    def on_mount(self) -> None:
        self.time_left = self.countdown.time_left
        self.update_display()
        self._sync_status()
        self.set_interval(0.1, self.tick)

    def tick(self) -> None:
        self.countdown.tick()
        self.time_left = self.countdown.time_left

        if self.countdown.is_finished and not self._finished_announced:
            self._finished_announced = True
            self.notify("Time's up!", severity="error", timeout=10)
            self.bell()
            self.query_one("#status", Static).update("Time's Up!")
            self.query_one("#status", Static).set_class(True, "danger")

        self.update_display()
        self._sync_status()

    def update_display(self) -> None:
        time_str = format_time(self.time_left, show_centiseconds=False)
        digits = self.query_one("#countdown", Digits)
        digits.update(time_str)

        # Subtle urgency cue while still respecting the palette.
        is_finished = self.countdown.is_finished
        is_paused = (not self.countdown.is_running) and (not is_finished)
        is_urgent = (not is_paused) and (is_finished or self.time_left < 10)

        digits.set_class(is_paused, "muted")
        digits.set_class(is_urgent, "danger")

    def action_toggle_pause(self) -> None:
        self.countdown.toggle()
        self._sync_status()

    def _sync_status(self) -> None:
        status_widget = self.query_one("#status", Static)

        is_finished = self.countdown.is_finished
        if is_finished:
            status_widget.update("Time's Up!")
            status_widget.set_class(True, "danger")
            status_widget.set_class(False, "running", "paused")
            return

        if self.countdown.is_running:
            status_widget.update("Running")
            status_widget.set_class(True, "running")
            status_widget.set_class(False, "paused", "danger")
        else:
            status_widget.update("Paused")
            status_widget.set_class(True, "paused")
            status_widget.set_class(False, "running", "danger")
