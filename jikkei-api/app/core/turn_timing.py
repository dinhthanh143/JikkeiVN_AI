# Lightweight per-phase latency instrumentation for the turn pipeline.
#
# Epic F3 (2026-06): added to answer "where is the time actually going" with
# real numbers instead of guessing — see the earlier conversation where
# WebSockets were considered and rejected as a latency fix; the actual
# suspects were prompt caching (Epic E), the two-phase stream/commit split
# (Epic F1), and unmeasured DB/retrieval work. This timer turns that
# suspicion into data.
#
# Deliberately NOT a dependency on any APM/tracing library — consistent with
# this codebase's "DB-only, no Redis" philosophy elsewhere. This is meant to
# be read directly from logs (grep "TURN_TIMING"), not shipped to a
# dashboard. If usage grows past that, a real tracing library is the
# upgrade path, not more code here.
import logging
import time
from contextlib import contextmanager

logger = logging.getLogger(__name__)


class TurnTimer:
    """
    Accumulates named phase durations across one request and logs them as a
    single line at the end, so one turn's full breakdown is grep-able as one
    log entry instead of scattered across many lines.

    Usage:
        timer = TurnTimer()
        with timer.phase("context_build"):
            ...
        with timer.phase("ai_call"):
            ...
        timer.log_summary(session_id=..., turn_number=...)
    """

    def __init__(self) -> None:
        self._phases: dict[str, float] = {}

    @contextmanager
    def phase(self, name: str):
        start = time.monotonic()
        try:
            yield
        finally:
            elapsed_ms = (time.monotonic() - start) * 1000
            # += in case the same phase name is entered more than once in a
            # single turn (e.g. a retry loop) — total time in that phase
            # matters more than which individual attempt took how long.
            self._phases[name] = self._phases.get(name, 0.0) + elapsed_ms

    def log_summary(self, **context) -> None:
        """
        context: arbitrary key=value pairs to prefix the log line with
        (session_id, turn_number, input_type, etc.) — kept as kwargs rather
        than positional so call sites stay self-documenting.
        """
        total_ms = sum(self._phases.values())
        context_str = " ".join(f"{k}={v}" for k, v in context.items())
        phases_str = " ".join(f"{name}={ms:.0f}ms" for name, ms in self._phases.items())
        logger.info("TURN_TIMING %s total=%.0fms %s", context_str, total_ms, phases_str)
