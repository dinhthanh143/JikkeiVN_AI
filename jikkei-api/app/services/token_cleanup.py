"""
Token cleanup service — removes expired refresh tokens on schedule.

Runs daily via APScheduler at 2 AM UTC.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.user import RefreshToken

logger = logging.getLogger(__name__)


async def cleanup_expired_tokens() -> dict:
    """
    Delete all refresh tokens that have expired (expires_at < now).

    Returns dict with cleanup stats for logging.
    """
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)

        result = await db.execute(
            delete(RefreshToken).where(
                RefreshToken.expires_at < now,
            )
        )
        await db.commit()

        deleted_count = result.rowcount
        logger.info(
            "Token cleanup completed: deleted %d expired tokens",
            deleted_count,
        )

        return {
            "deleted_count": deleted_count,
            "cleanup_time": now.isoformat(),
        }
