# Player settings service — reads/writes the jsonb `settings` blob on users.
# No dedicated table/row anymore: settings live directly on User.settings.
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import DEFAULT_USER_SETTINGS, User


async def get_or_create_settings(user_id: UUID, db: AsyncSession) -> dict:
    """
    Fetch the user's settings dict, backfilling any missing keys with defaults
    in-memory (covers rows created before a key existed). Persists the merged
    dict back to the row only if it was actually missing keys.
    """
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise ValueError(f"User {user_id} not found")

    current = dict(user.settings or {})
    merged = {**DEFAULT_USER_SETTINGS, **current}

    if merged != current:
        user.settings = merged
        await db.commit()
        await db.refresh(user)

    return user.settings


async def update_settings(user_id: UUID, updates: dict, db: AsyncSession) -> dict:
    """Apply only the provided (non-None) fields onto the user's settings dict."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise ValueError(f"User {user_id} not found")

    merged = {**DEFAULT_USER_SETTINGS, **(user.settings or {})}
    for field, value in updates.items():
        if value is not None:
            merged[field] = value

    # Reassign (not mutate in place) so SQLAlchemy's change-tracking on the
    # JSONB column picks up the update.
    user.settings = merged
    await db.commit()
    await db.refresh(user)
    return user.settings
