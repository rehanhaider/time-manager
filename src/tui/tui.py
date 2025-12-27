from time import monotonic
from textual.app import App, ComposeResult
from textual.containers import Container
from textual.widgets import Header, Footer, Digits, Button, Static
from textual.reactive import reactive


class StopwatchApp(App):
    """A simple stopwatch app."""

    CSS = """
    StopwatchApp {
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
    start_time = reactive(monotonic())
    running = reactive(False)
    accumulated_time = reactive(0.0)

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Container(id="display-container"):
            yield Digits("00:00.00", id="time-display")
        with Container(id="buttons"):
            yield Button("Start", id="start", variant="success", classes="start")
            yield Button("Stop", id="stop", variant="error", classes="stop", disabled=True)
            yield Button("Reset", id="reset", variant="warning", classes="reset")
        yield Footer()

    def on_mount(self) -> None:
        self.set_interval(1 / 60, self.update_time)

    def update_time(self) -> None:
        if self.running:
            self.time_elapsed = self.accumulated_time + (monotonic() - self.start_time)

        minutes, seconds = divmod(self.time_elapsed, 60)
        hours, minutes = divmod(minutes, 60)
        centiseconds = int((self.time_elapsed * 100) % 100)

        if hours > 0:
            time_str = f"{int(hours):02}:{int(minutes):02}:{int(seconds):02}.{centiseconds:02}"
        else:
            time_str = f"{int(minutes):02}:{int(seconds):02}.{centiseconds:02}"

        self.query_one("#time-display", Digits).update(time_str)

    def action_toggle_timer(self) -> None:
        if self.running:
            self.stop_timer()
        else:
            self.start_timer()

    def action_reset_timer(self) -> None:
        self.reset_timer()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "start":
            self.start_timer()
        elif event.button.id == "stop":
            self.stop_timer()
        elif event.button.id == "reset":
            self.reset_timer()

    def start_timer(self):
        if not self.running:
            self.start_time = monotonic()
            self.running = True
            self.query_one("#start").disabled = True
            self.query_one("#stop").disabled = False

    def stop_timer(self):
        if self.running:
            self.accumulated_time += monotonic() - self.start_time
            self.running = False
            self.query_one("#start").disabled = False
            self.query_one("#stop").disabled = True

    def reset_timer(self):
        self.running = False
        self.accumulated_time = 0.0
        self.time_elapsed = 0.0
        self.query_one("#time-display", Digits).update("00:00.00")
        self.query_one("#start").disabled = False
        self.query_one("#stop").disabled = True


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
