from textual.app import App, ComposeResult
from textual.containers import Container
from textual.widgets import Digits, Footer, Header, Static
from textual.reactive import reactive
from core.formatting import format_time
from core.timer import Countdown


class CountdownTui(App):
    """A countdown timer app."""

    CSS = """
    CountdownTui {
        align: center middle;
        background: $surface;
    }
    
    #display-container {
        height: auto;
        width: auto;
        border: heavy $primary;
        padding: 1 2;
        background: $surface-lighten-1;
    }

    Digits {
        text-align: center;
        width: auto;
        color: $text;
        text-style: bold;
    }
    #status {
        text-align: center;
        margin-top: 1;
        color: $secondary;
    }
    """

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
        with Container(id="display-container"):
            yield Digits("", id="countdown")
            yield Static("Running", id="status")
        yield Footer()

    def on_mount(self) -> None:
        self.time_left = self.countdown.time_left
        self.update_display()
        self.set_interval(0.1, self.tick)

    def tick(self) -> None:
        self.countdown.tick()
        self.time_left = self.countdown.time_left

        if self.countdown.is_finished and not self._finished_announced:
            self._finished_announced = True
            self.notify("Time's up!", severity="error", timeout=10)
            self.bell()
            self.query_one("#status", Static).update("Time's Up!")
            self.query_one("#status", Static).styles.color = "red"

        self.update_display()

    def update_display(self) -> None:
        time_str = format_time(self.time_left, show_centiseconds=False)
        self.query_one("#countdown", Digits).update(time_str)

    def action_toggle_pause(self) -> None:
        self.countdown.toggle()
        status = "Running" if self.countdown.is_running else "Paused"
        self.query_one("#status", Static).update(status)
