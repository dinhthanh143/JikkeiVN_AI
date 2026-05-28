# Gamification service -- get-or-create user_game_profile + daily coin claim.
# Mirrors credit_service.py's get-or-create + IntegrityError race handling.
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user_game_profile import UserGameProfile

_CLAIM_COOLDOWN = timedelta(hours=24)


async def _fetch_profile(user_id: UUID, db: AsyncSession) -> UserGameProfile | None:
    result = await db.execute(select(UserGameProfile).where(UserGameProfile.user_id == user_id))
    return result.scalar_one_or_none()


async def get_or_create_game_profile(user_id: UUID, db: AsyncSession) -> UserGameProfile:
    """Fetch a user's game profile, provisioning one on-the-fly for accounts
    that pre-date this feature (register/oauth-complete provision it eagerly
    for everyone else)."""
    profile = await _fetch_profile(user_id, db)
    if profile is not None:
        return profile

    profile = UserGameProfile(user_id=user_id, coins=50, gems=0)
    db.add(profile)
    try:
        await db.commit()
        await db.refresh(profile)
    except IntegrityError:
        # Concurrent first-use requests may race on unique user_id.
        await db.rollback()
        existing = await _fetch_profile(user_id, db)
        if existing is None:
            raise
        profile = existing
    return profile


async def claim_daily_reward(user_id: UUID, db: AsyncSession) -> tuple[UserGameProfile, int]:
    """Award settings.DAILY_COIN_AMOUNT coins if the last claim was >= 24h
    ago (or never). Raises HTTPException(400) with next_claimable_at if the
    cooldown hasn't elapsed yet. Returns the updated profile + amount awarded."""
    await get_or_create_game_profile(user_id, db)
    now = datetime.now(timezone.utc)
    daily_amount = settings.DAILY_COIN_AMOUNT
    result = await db.execute(
        update(UserGameProfile)
        .where(
            UserGameProfile.user_id == user_id,
            or_(
                UserGameProfile.last_daily_claimed_at.is_(None),
                UserGameProfile.last_daily_claimed_at <= now - _CLAIM_COOLDOWN,
            ),
        )
        .values(
            coins=UserGameProfile.coins + daily_amount,
            last_daily_claimed_at=now,
        )
        .returning(UserGameProfile.id)
        .execution_options(synchronize_session=False)
    )
    if result.scalar_one_or_none() is not None:
        await db.commit()
        profile = await _fetch_profile(user_id, db)
        if profile is None:
            raise RuntimeError("Game profile disappeared during daily claim")
        return profile, daily_amount

    await db.rollback()
    profile = await _fetch_profile(user_id, db)
    if profile is None or profile.last_daily_claimed_at is None:
        raise RuntimeError("Game profile disappeared during daily claim")
    last_claimed = profile.last_daily_claimed_at
    if last_claimed.tzinfo is None:
        last_claimed = last_claimed.replace(tzinfo=timezone.utc)
    next_claimable = last_claimed + _CLAIM_COOLDOWN
    raise HTTPException(
        status_code=400,
        detail={
            "code": "DAILY_ALREADY_CLAIMED",
            "next_claimable_at": next_claimable.isoformat(),
            "message": "Daily already claimed. Come back tomorrow.",
        },
    )
