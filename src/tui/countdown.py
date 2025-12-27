from textual.app import App, ComposeResult
from textual.widgets import Container, Digits, Footer, Header, Static
from textual.reactive import reactive


class CountdownApp(App):
    """A countdown timer app."""

    CSS = """
    CountdownApp {
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

    time_left = reactive(0)

    def __init__(self, seconds: int):
        super().__init__()
        self.initial_seconds = seconds
        self.time_left = seconds
        self.paused = False
        self.timer_widget = None

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Container(id="display-container"):
            yield Digits("", id="countdown")
            yield Static("Running", id="status")
        yield Footer()

    def on_mount(self) -> None:
        self.update_display()
        self.timer_widget = self.set_interval(1, self.tick)

    def tick(self) -> None:
        if not self.paused and self.time_left > 0:
            self.time_left -= 1
            if self.time_left <= 0:
                self.time_left = 0
                self.notify("Time's up!", severity="error", timeout=10)
                self.bell()
                self.query_one("#status", Static).update("Time's Up!")
                self.query_one("#status", Static).styles.color = "red"
        self.update_display()

    def update_display(self) -> None:
        minutes, seconds = divmod(self.time_left, 60)
        hours, minutes = divmod(minutes, 60)
        if hours > 0:
            time_str = f"{hours:02}:{minutes:02}:{seconds:02}"
        else:
            time_str = f"{minutes:02}:{seconds:02}"
        self.query_one("#countdown", Digits).update(time_str)

    def action_toggle_pause(self) -> None:
        self.paused = not self.paused
        status = "Paused" if self.paused else "Running"
        self.query_one("#status", Static).update(status)
