import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

# Ensure `src/` is importable when running tests directly.
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_SRC_PATH = os.path.join(_REPO_ROOT, "src")
if _SRC_PATH not in sys.path:
    sys.path.insert(0, _SRC_PATH)


class _FakeDateTime:
    """Simple stand-in for datetime with controllable now()."""

    _times: list[datetime] = []

    @classmethod
    def set_times(cls, times: list[datetime]) -> None:
        cls._times = list(times)

    @classmethod
    def now(cls, tz=None):  # noqa: D401 - signature compatible with datetime.now
        if not cls._times:
            raise AssertionError("No fake times left for datetime.now()")
        t = cls._times.pop(0)
        if tz is None:
            return t.replace(tzinfo=None)
        return t.astimezone(tz)


class TestStopwatchClockBehavior(unittest.TestCase):
    def test_stopwatch_duration_uses_monotonic_even_if_wall_clock_jumps(self):
        # Arrange: wall clock advances by 1h10m, but monotonic advances only 10m.
        wall_start = datetime(2026, 3, 9, 13, 53, tzinfo=timezone.utc)
        wall_end = wall_start + timedelta(minutes=70)
        _FakeDateTime.set_times([wall_start, wall_end])

        monotonic_values = [1000.0, 1600.0]  # 10 minutes elapsed

        with patch("core.termclock.datetime", _FakeDateTime), patch(
            "core.termclock.monotonic", side_effect=monotonic_values
        ):
            from core.termclock import Stopwatch

            sw = Stopwatch()
            sw.start()
            sw.stop()

        self.assertEqual(len(sw.runs), 1)
        run = sw.runs[0]

        self.assertAlmostEqual(run.duration, 600.0, places=6)
        # Drift should reflect wall_delta - monotonic_delta = 4200 - 600 = +3600 seconds.
        self.assertAlmostEqual(run.clock_drift, 3600.0, places=6)
        self.assertFalse(sw.is_running)
        self.assertAlmostEqual(sw.elapsed, 600.0, places=6)

    def test_reset_while_running_does_not_record_a_run(self):
        # Arrange: start stopwatch, advance monotonic, then reset.
        wall_start = datetime(2026, 3, 9, 13, 53, tzinfo=timezone.utc)
        _FakeDateTime.set_times([wall_start])

        monotonic_values = [500.0, 800.0]  # would be 5 minutes if stopped, but we reset

        with patch("core.termclock.datetime", _FakeDateTime), patch(
            "core.termclock.monotonic", side_effect=monotonic_values
        ):
            from core.termclock import Stopwatch

            sw = Stopwatch()
            sw.start()
            # elapsed would be computed from monotonic if queried, but reset should forget everything
            _ = sw.elapsed
            sw.reset()

        self.assertFalse(sw.is_running)
        self.assertEqual(sw.elapsed, 0.0)
        self.assertEqual(sw.runs, [])

    def test_stop_safe_shutdown_when_start_mono_missing(self):
        # If internal state is corrupted (running but no start_mono),
        # stop() should not crash and should shut down safely without appending.
        with patch("core.termclock.monotonic", return_value=123.0):
            from core.termclock import Stopwatch

            sw = Stopwatch()
            sw._running = True
            sw._start_time = None
            sw.stop()

        self.assertFalse(sw.is_running)
        self.assertEqual(sw.runs, [])


if __name__ == "__main__":
    unittest.main()

