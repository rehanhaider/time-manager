from time import monotonic
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timezone


CLOCK_DRIFT_THRESHOLD = 30.0  # seconds


@dataclass
class StopwatchRun:
    """Represents a single stopwatch run."""

    start_time: datetime
    end_time: datetime | None = None
    duration: float = 0.0
    start_mono: float = 0.0
    end_mono: float = 0.0
    clock_drift: float = 0.0


@dataclass
class Stopwatch:
    """Core logic for a stopwatch."""

    _start_time: Optional[float] = None
    _accumulated_time: float = 0.0
    _running: bool = False
    _runs: list[StopwatchRun] = field(default_factory=list)
    _current_run_start: datetime | None = None

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def elapsed(self) -> float:
        """Return the total elapsed time in seconds."""
        if self._running and self._start_time is not None:
            return self._accumulated_time + (monotonic() - self._start_time)
        return self._accumulated_time

    @property
    def runs(self) -> list[StopwatchRun]:
        """Return all completed and current runs."""
        return self._runs

    @property
    def has_drift(self) -> bool:
        """Return True if any run had significant clock drift."""
        return any(run.clock_drift != 0.0 for run in self._runs)

    def start(self):
        if not self._running:
            self._start_time = monotonic()
            self._running = True
            self._current_run_start = datetime.now(timezone.utc)

    def stop(self):
        if not self._running:
            return

        start_mono = self._start_time
        end_mono = monotonic()
        end_time = datetime.now(timezone.utc)

        if start_mono is None:
            self._force_safe_shutdown()
            return

        elapsed_in_run = end_mono - start_mono

        wall_delta = 0.0
        if self._current_run_start:
            wall_delta = (end_time - self._current_run_start).total_seconds()

        drift = wall_delta - elapsed_in_run
        if abs(drift) < CLOCK_DRIFT_THRESHOLD:
            drift = 0.0

        self._accumulated_time += elapsed_in_run

        self._runs.append(
            StopwatchRun(
                start_time=self._current_run_start or end_time,
                end_time=end_time,
                duration=elapsed_in_run,
                start_mono=start_mono,
                end_mono=end_mono,
                clock_drift=drift,
            )
        )

        self._force_safe_shutdown()

    def _force_safe_shutdown(self):
        """Force a safe shutdown regardless of state."""
        self._running = False
        self._start_time = None
        self._current_run_start = None

    def reset(self):
        # Reset means "forget everything" (including any currently running session).
        # We intentionally do NOT record a run here.
        self._force_safe_shutdown()
        self._accumulated_time = 0.0
        self._runs.clear()

    def toggle(self):
        if self._running:
            self.stop()
        else:
            self.start()


@dataclass
class Countdown:
    """Core logic for a countdown timer."""

    initial_seconds: int
    _time_left: float = field(init=False)
    _last_tick: Optional[float] = field(init=False, default=None)
    _running: bool = field(init=False, default=True)

    def __post_init__(self):
        self._time_left = float(self.initial_seconds)
        self._last_tick = monotonic()

    @property
    def time_left(self) -> float:
        return max(0.0, self._time_left)

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def is_finished(self) -> bool:
        return self._time_left <= 0

    def tick(self):
        """Update the timer based on elapsed real time."""
        if self._running and self._time_left > 0:
            now = monotonic()
            if self._last_tick is not None:
                delta = now - self._last_tick
                self._time_left -= delta
            self._last_tick = now
        else:
            self._last_tick = monotonic()

    def pause(self):
        self._running = False
        self._last_tick = None

    def resume(self):
        if not self._running:
            self._running = True
            self._last_tick = monotonic()

    def toggle(self):
        if self._running:
            self.pause()
        else:
            self.resume()
