# Credit budget service — rolling-window usage caps and per-turn deductions.
#
# TASK-011: replaced the old UTC-daily reset with a rolling window, same
# mechanic as Claude's usage limits: a window starts on first use and
# expires CREDIT_WINDOW_HOURS later, at which point credits_remaining resets
# to the caller's tier cap. There is no fixed clock boundary anymore — two
# users can be on completely different reset times depending on when they
# started playing.
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.scene import UserCredits
from app.services.subscription_service import get_effective_tier


def _session_cap_for_tier(tier: str) -> int:
    return settings.SESSION_CREDITS_PREMIUM if tier == "premium" else settings.SESSION_CREDITS_FREE


def _window_expired(window_started_at: datetime | None, now: datetime) -> bool:
    """True if there's no active window yet, or the current one has expired."""
    if window_started_at is None:
        return True
    started = window_started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    return now >= started + timedelta(hours=settings.CREDIT_WINDOW_HOURS)


async def _fetch_credits(user_id: UUID, db: AsyncSession) -> UserCredits | None:
    result = await db.execute(select(UserCredits).where(UserCredits.user_id == user_id))
    return result.scalar_one_or_none()


async def get_or_create_credits(user_id: UUID, db: AsyncSession) -> UserCredits:
    """
    Fetch a user's credits row, creating it if this is their first time.
    Replenishes (resets credits_remaining to the tier cap, restarts the
    window) whenever the current window has expired or never started.
    """
    now = datetime.now(timezone.utc)
    tier = await get_effective_tier(user_id, db)
    cap = _session_cap_for_tier(tier)

    credits = await _fetch_credits(user_id, db)

    if credits is None:
        credits = UserCredits(
            user_id=user_id,
            credits_remaining=cap,
            credits_lifetime_used=0,
            window_started_at=now,
            created_at=now,
        )
        db.add(credits)
        try:
            await db.commit()
            await db.refresh(credits)
        except IntegrityError:
            # Concurrent first-use requests may race on unique user_id.
            await db.rollback()
            existing = await _fetch_credits(user_id, db)
            if existing is None:
                raise
            credits = existing

    if _window_expired(credits.window_started_at, now):
        cutoff = now - timedelta(hours=settings.CREDIT_WINDOW_HOURS)
        await db.execute(
            update(UserCredits)
            .where(
                UserCredits.user_id == user_id,
                or_(
                    UserCredits.window_started_at.is_(None),
                    UserCredits.window_started_at <= cutoff,
                ),
            )
            .values(credits_remaining=cap, window_started_at=now)
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        refreshed = await _fetch_credits(user_id, db)
        if refreshed is None:
            raise RuntimeError("Credits row disappeared during window reset")
        credits = refreshed

    return credits


async def consume_credit(user_id: UUID, db: AsyncSession) -> None:
    """Deduct 1 credit for an AI turn. Raise HTTPException 429 if exhausted."""
    await get_or_create_credits(user_id, db)
    result = await db.execute(
        update(UserCredits)
        .where(
            UserCredits.user_id == user_id,
            UserCredits.credits_remaining > 0,
        )
        .values(
            credits_remaining=UserCredits.credits_remaining - 1,
            credits_lifetime_used=UserCredits.credits_lifetime_used + 1,
        )
        .returning(UserCredits.credits_remaining)
        .execution_options(synchronize_session=False)
    )
    if result.scalar_one_or_none() is not None:
        await db.commit()
        return

    await db.rollback()
    credits = await _fetch_credits(user_id, db)
    if credits is None:
        raise RuntimeError("Credits row disappeared during deduction")

    window_started = credits.window_started_at or datetime.now(timezone.utc)
    if window_started.tzinfo is None:
        window_started = window_started.replace(tzinfo=timezone.utc)
    resets_at = window_started + timedelta(hours=settings.CREDIT_WINDOW_HOURS)
    resets_at_iso = resets_at.isoformat()
    raise HTTPException(
        status_code=429,
        detail={
            "error": "CREDITS_EXHAUSTED",
            "message": f"Credits exhausted. Resets at {resets_at_iso}",
            "credits_remaining": 0,
            "resets_at": resets_at_iso,
        },
    )


async def get_credits_remaining(user_id: UUID, db: AsyncSession) -> int:
    """Return remaining credits."""
    credits = await get_or_create_credits(user_id, db)
    return credits.credits_remaining
