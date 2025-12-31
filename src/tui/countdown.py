from textual.app import App, ComposeResult
from textual.containers import Container
from textual.widgets import Digits, Footer, Header, Static
from textual.reactive import reactive
from core.formatting import format_time
from core.timer import Countdown
from tui.theme import TIMER_CSS, DANGER, MUTED, SECONDARY


class CountdownTui(App):
    """A countdown timer app."""

    TITLE = "Timer"
    SUB_TITLE = "Countdown"

    CSS = TIMER_CSS

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
            with Container(id="display-container"):
                yield Digits("00:00", id="countdown")
                yield Static("Running", id="status")
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
            self.query_one("#status", Static).styles.color = DANGER

        self.update_display()
        self._sync_status()

    def update_display(self) -> None:
        time_str = format_time(self.time_left, show_centiseconds=False)
        digits = self.query_one("#countdown", Digits)
        digits.update(time_str)

        # Subtle urgency cue while still respecting the palette.
        if not self.countdown.is_running and not self.countdown.is_finished:
            digits.styles.color = MUTED
        elif self.countdown.is_finished or self.time_left < 10:
            digits.styles.color = DANGER
        else:
            digits.styles.color = SECONDARY

    def action_toggle_pause(self) -> None:
        self.countdown.toggle()
        self._sync_status()

    def _sync_status(self) -> None:
        status_widget = self.query_one("#status", Static)

        if self.countdown.is_finished:
            status_widget.update("Time's Up!")
            status_widget.styles.color = DANGER
            return

        if self.countdown.is_running:
            status_widget.update("Running")
            status_widget.styles.color = SECONDARY
        else:
            status_widget.update("Paused")
            status_widget.styles.color = MUTED
