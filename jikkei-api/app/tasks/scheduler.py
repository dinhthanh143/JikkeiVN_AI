"""
Scheduled task manager — initializes background job scheduler.

Current jobs:
  - Token cleanup: daily at 2 AM UTC (configurable)
"""

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from loguru import logger as loguru_logger

from app.services.token_cleanup import cleanup_expired_tokens

logger = logging.getLogger(__name__)

scheduler: AsyncIOScheduler | None = None


def init_scheduler() -> AsyncIOScheduler:
    """
    Initialize and start the background task scheduler.
    Call this during app startup.
    """
    global scheduler

    scheduler = AsyncIOScheduler()

    # Schedule token cleanup daily at 2 AM UTC.
    # In production, adjust time to avoid peak load hours.
    scheduler.add_job(
        cleanup_expired_tokens,
        "cron",
        hour=2,
        minute=0,
        id="token_cleanup_daily",
        name="Daily token cleanup (expired tokens)",
        # Coalesce: if scheduler misses a run, catch up on next trigger.
        coalesce=True,
        # Max instances: only run 1 cleanup at a time (no parallelism).
        max_instances=1,
    )

    scheduler.start()
    loguru_logger.info("Scheduled task scheduler initialized")
    loguru_logger.info("Jobs scheduled: token_cleanup_daily (2 AM UTC daily)")

    return scheduler


async def shutdown_scheduler() -> None:
    """Gracefully shut down the scheduler. Call during app shutdown."""
    global scheduler
    if scheduler:
        try:
            scheduler.shutdown(wait=True)
        except Exception as e:
            loguru_logger.warning(f"Error shutting down scheduler: {e}")
        finally:
            scheduler = None
            loguru_logger.info("Scheduled task scheduler shut down")
