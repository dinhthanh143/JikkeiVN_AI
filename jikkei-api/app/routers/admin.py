# Admin-only routes for user management and dashboard stats.
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import delete as sql_delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import require_admin
from app.models.scene import Scene
from app.models.user import RefreshToken, User
from app.schemas.auth import UserAdminResponse
from app.services.token_cleanup import cleanup_expired_tokens


class RoleUpdateRequest(BaseModel):
    role: Literal["user", "admin"]


class StatusUpdateRequest(BaseModel):
    is_active: bool
    reason: str | None = None   # optional admin note, not stored yet — reserved for future audit log


class AdminUsersListResponse(BaseModel):
    items: list[UserAdminResponse]
    total: int
    limit: int
    offset: int
    has_next: bool


router = APIRouter(dependencies=[Depends(require_admin)])


@router.get("/users", response_model=AdminUsersListResponse)
async def list_users(
    db: AsyncSession = Depends(get_db),
    q: str | None = Query(default=None, max_length=100),
    role: Literal["user", "admin"] | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AdminUsersListResponse:
    filters = []

    cleaned_query = q.strip() if q else None
    if cleaned_query:
        pattern = f"%{cleaned_query}%"
        filters.append(
            or_(
                User.username.ilike(pattern),
                User.email.ilike(pattern),
            )
        )

    if role is not None:
        filters.append(User.role == role)

    if is_active is not None:
        filters.append(User.is_active.is_(is_active))

    count_stmt = select(func.count()).select_from(User)
    users_stmt = select(User)

    if filters:
        count_stmt = count_stmt.where(*filters)
        users_stmt = users_stmt.where(*filters)

    total = int(await db.scalar(count_stmt) or 0)

    users_stmt = users_stmt.order_by(User.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(users_stmt)
    users: Sequence[User] = result.scalars().all()
    items = [UserAdminResponse.model_validate(u) for u in users]

    return AdminUsersListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_next=(offset + len(items)) < total,
    )


@router.patch("/users/{user_id}/role", response_model=UserAdminResponse)
async def update_user_role(
    user_id: UUID,
    payload: RoleUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> UserAdminResponse:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    return UserAdminResponse.model_validate(user)


@router.delete("/users/{user_id}")
async def soft_delete_user(user_id: UUID, db: AsyncSession = Depends(get_db)) -> dict[str, bool]:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = False
    await db.commit()
    return {"ok": True}


@router.patch("/users/{user_id}/status", response_model=UserAdminResponse)
async def update_user_status(
    user_id: UUID,
    payload: StatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> UserAdminResponse:
    """
    Suspend (is_active=False) or reinstate (is_active=True) a user account.

    On suspension:
    - Sets is_active = False on the User row
    - Cascade-revokes ALL active refresh tokens for this user so their
      session ends within one token-refresh cycle (~30 min) rather than
      waiting for their access token to expire naturally.

    On reinstatement:
    - Sets is_active = True
    - Does NOT issue new tokens (user must log in again themselves)
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent suspending another admin via this endpoint — safety guard.
    if not payload.is_active and user.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot suspend an admin account via this endpoint.",
        )

    user.is_active = payload.is_active

    if not payload.is_active:
        await db.execute(
            sql_delete(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.is_revoked.is_(False),
            )
        )

    await db.commit()
    await db.refresh(user)
    return UserAdminResponse.model_validate(user)


@router.get("/users/inactive", response_model=AdminUsersListResponse)
async def list_inactive_users(
    db: AsyncSession = Depends(get_db),
    inactive_days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AdminUsersListResponse:
    """
    List active users who haven't been seen in > inactive_days days.
    Includes users where last_seen_at IS NULL (registered but never
    triggered a refresh). Only returns is_active=True users — suspended
    users are already handled separately by the main /users list + filter.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=inactive_days)
    filters = [
        User.is_active.is_(True),
        or_(User.last_seen_at < cutoff, User.last_seen_at.is_(None)),
    ]

    total = int(await db.scalar(select(func.count()).select_from(User).where(*filters)) or 0)
    result = await db.execute(
        select(User).where(*filters)
        .order_by(User.last_seen_at.asc().nulls_first())  # longest inactive first
        .limit(limit).offset(offset)
    )
    users = result.scalars().all()
    items = [UserAdminResponse.model_validate(u) for u in users]
    return AdminUsersListResponse(items=items, total=total, limit=limit, offset=offset, has_next=(offset + len(items)) < total)


@router.get("/users/{user_id}", response_model=UserAdminResponse)
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db)) -> UserAdminResponse:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserAdminResponse.model_validate(user)


@router.get("/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    inactive_days: int = Query(default=30, ge=1, le=365),
) -> dict:
    """
    Dashboard stats for AdminOverviewPanel + Activity panel.
    inactive_days: threshold for the top-level "not seen in N days" bucket
    (default 30, choosable) — also drives one entry of inactive_buckets.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=inactive_days)

    total_users   = await db.scalar(select(func.count()).select_from(User))
    active_users  = await db.scalar(select(func.count()).select_from(User).where(User.is_active.is_(True)))
    suspended     = await db.scalar(select(func.count()).select_from(User).where(User.is_active.is_(False)))
    total_admins  = await db.scalar(select(func.count()).select_from(User).where(User.role == "admin"))

    # "Inactive" = last_seen_at older than cutoff OR last_seen_at IS NULL
    # (never triggered a refresh since the column was added).
    inactive_count = await db.scalar(
        select(func.count()).select_from(User).where(
            User.is_active.is_(True),
            or_(User.last_seen_at < cutoff, User.last_seen_at.is_(None)),
        )
    )

    total_scenes  = await db.scalar(select(func.count()).select_from(Scene))
    public_scenes = await db.scalar(select(func.count()).select_from(Scene).where(Scene.is_public.is_(True)))

    # Inactive user buckets — for the histogram in the Activity panel.
    buckets: dict[str, int] = {}
    for days in [7, 14, 30, 60, 90]:
        b_cutoff = now - timedelta(days=days)
        count = await db.scalar(
            select(func.count()).select_from(User).where(
                User.is_active.is_(True),
                or_(User.last_seen_at < b_cutoff, User.last_seen_at.is_(None)),
            )
        )
        buckets[f"inactive_{days}d"] = int(count or 0)

    return {
        "total_users":     int(total_users or 0),
        "active_users":    int(active_users or 0),
        "suspended_users": int(suspended or 0),
        "total_admins":    int(total_admins or 0),
        "inactive_count":  int(inactive_count or 0),
        "inactive_days_threshold": inactive_days,
        "inactive_buckets": buckets,
        "total_scenes":    int(total_scenes or 0),
        "public_scenes":   int(public_scenes or 0),
    }


@router.post("/maintenance/cleanup-tokens")
async def trigger_token_cleanup() -> dict:
    """
    Admin-only endpoint to manually trigger expired token cleanup.
    Useful for testing or forcing immediate cleanup outside scheduled window.
    Returns cleanup statistics.
    """
    result = await cleanup_expired_tokens()
    return {
        "status": "completed",
        **result,
    }
