# Resolves a user's effective tier from their subscription state.
# Never trust a static flag — always check plan + status + period dates,
# so an expired or canceled premium subscription correctly falls back to free.

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserSubscription


async def get_effective_tier(user_id: UUID, db: AsyncSession) -> str:
    """
    Returns 'premium' only if the user has an active, non-expired premium
    subscription right now. Returns 'free' for everyone else — no row,
    wrong plan, canceled/past_due status, or an expired current_period_end.

    This is the single source of truth for tier checks anywhere in the app.
    Never read a static tier column — subscriptions can lapse without any
    other code path remembering to flip a flag back to 'free'.
    """
    sub = (await db.execute(
        select(UserSubscription).where(
            UserSubscription.user_id == user_id,
            UserSubscription.plan == "premium",
            UserSubscription.status == "active",
        )
    )).scalar_one_or_none()

    if sub is None:
        return "free"

    if sub.current_period_end is not None and sub.current_period_end <= datetime.now(timezone.utc):
        return "free"

    return "premium"
