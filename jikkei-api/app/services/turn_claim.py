"""Cross-worker serialization for expensive scene turns.

The claim is committed before the provider call, so no database transaction or
row lock stays open while Gemini is running. A TTL recovers claims left behind
by a crashed worker.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.scene import SceneSession


async def claim_session_turn(session_id: UUID, db: AsyncSession) -> UUID:
    """Atomically claim a session for one in-flight turn."""
    now = datetime.now(timezone.utc)
    stale_before = now - timedelta(seconds=settings.TURN_CLAIM_TTL_SECONDS)
    claim_id = uuid4()
    result = await db.execute(
        update(SceneSession)
        .where(
            SceneSession.id == session_id,
            or_(
                SceneSession.turn_claim_id.is_(None),
                SceneSession.turn_claimed_at.is_(None),
                SceneSession.turn_claimed_at < stale_before,
            ),
        )
        .values(turn_claim_id=claim_id, turn_claimed_at=now)
        .returning(SceneSession.turn_claim_id)
        .execution_options(synchronize_session=False)
    )
    acquired = result.scalar_one_or_none()
    if acquired is None:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "TURN_IN_PROGRESS",
                "message": "Another turn is already being generated for this session.",
            },
        )
    await db.commit()
    return claim_id


async def assert_session_turn_claim(session_id: UUID, claim_id: UUID, db: AsyncSession) -> None:
    """Reject persistence if this worker no longer owns the session claim."""
    active_claim = await db.scalar(
        select(SceneSession.turn_claim_id).where(SceneSession.id == session_id)
    )
    if active_claim != claim_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "TURN_CLAIM_LOST",
                "message": "The turn claim expired before persistence.",
            },
        )


async def release_session_turn(
    session_id: UUID,
    claim_id: UUID,
    db: AsyncSession | None = None,
) -> None:
    """Release a claim if it is still owned by the caller."""
    if db is None:
        async with AsyncSessionLocal() as owned_db:
            await release_session_turn(session_id, claim_id, owned_db)
        return

    await db.rollback()
    await db.execute(
        update(SceneSession)
        .where(
            SceneSession.id == session_id,
            SceneSession.turn_claim_id == claim_id,
        )
        .values(turn_claim_id=None, turn_claimed_at=None)
        .execution_options(synchronize_session=False)
    )
    await db.commit()
