from textual.app import App, ComposeResult
from textual.containers import Container
from textual.widgets import Header, Footer, Digits, Button
from textual.reactive import reactive
from core.formatting import format_time
from core.timer import Stopwatch


class StopwatchTui(App):
    """A simple stopwatch app."""

    CSS = """
    StopwatchTui {
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
    
    #buttons {
        layout: horizontal;
        align: center middle;
        margin-top: 2;
        height: auto;
        width: auto;
    }
    
    Button {
        margin: 0 1;
        min-width: 16;
    }
    
    Button.start {
        background: $success;
        color: $text;
    }
    
    Button.stop {
        background: $error;
        color: $text;
    }
    
    Button.reset {
        background: $warning;
        color: $text;
    }
    """

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
        with Container(id="display-container"):
            yield Digits("00:00.00", id="time-display")
        with Container(id="buttons"):
            yield Button("Start", id="start", variant="success", classes="start")
            yield Button(
                "Stop", id="stop", variant="error", classes="stop", disabled=True
            )
            yield Button("Reset", id="reset", variant="warning", classes="reset")
        yield Footer()

    def on_mount(self) -> None:
        self.set_interval(1 / 60, self.update_time)

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
        if self.stopwatch.is_running:
            self.query_one("#start").disabled = True
            self.query_one("#stop").disabled = False
        else:
            self.query_one("#start").disabled = False
            self.query_one("#stop").disabled = True
