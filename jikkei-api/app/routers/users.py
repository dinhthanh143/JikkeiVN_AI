"""
Public user profile routes — no auth required.

Exposes a player's public-facing profile (display name, avatar, banner,
bio, derived age, tier badge, public story stats) and their list of public
stories, for use by ProfilePage / UserStoriesPage on the frontend.

Deliberately separate from auth.py (which is large and focused on
authentication/session lifecycle) — these routes have nothing to do with
the requesting user's own auth state, only the *target* username's public
data.
"""

from datetime import date
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.scene import Scene
from app.models.user import User
from app.routers.scene import _build_scene_response
from app.schemas.auth import PublicUserProfileResponse
from app.schemas.scene import SceneResponse
from app.services.subscription_service import get_effective_tier

logger = logging.getLogger(__name__)
router = APIRouter(tags=["users"])


def calculate_age(dob: date | None) -> int | None:
    if dob is None:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


async def _get_active_user_by_username(username: str, db: AsyncSession) -> User:
    user = (await db.execute(
        select(User).where(func.lower(User.username) == username.lower(), User.is_active == True)
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("/users/{username}/profile", response_model=PublicUserProfileResponse)
async def get_user_profile(username: str, db: AsyncSession = Depends(get_db)) -> PublicUserProfileResponse:
    user = await _get_active_user_by_username(username, db)

    tier = await get_effective_tier(user.id, db)
    count_result = (await db.execute(
        select(func.count(Scene.id), func.coalesce(func.sum(Scene.play_count), 0))
        .where(Scene.user_id == user.id, Scene.is_public == True)
    )).one()
    public_story_count, total_plays = int(count_result[0]), int(count_result[1])

    return PublicUserProfileResponse(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        profile_banner=user.profile_banner,
        bio=user.bio,
        age=calculate_age(user.date_of_birth),
        joined_year=user.created_at.year,
        tier=tier,
        public_story_count=public_story_count,
        total_plays=total_plays,
    )


@router.get("/users/{username}/stories", response_model=list[SceneResponse])
async def get_user_public_stories(
    username: str,
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None, max_length=100),
    nsfw: str | None = Query(None, pattern="^(sfw|nsfw)$"),
    tier: str | None = Query(None, pattern="^(free|premium)$"),
    game_mode: str | None = Query(None, pattern="^(normal|survival)$"),
    sort: str = Query("most_played", pattern="^(most_played|newest|oldest)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
) -> list[SceneResponse]:
    user = await _get_active_user_by_username(username, db)

    query = select(Scene).where(Scene.user_id == user.id, Scene.is_public == True)

    # Search: title only (case-insensitive) — mirrors browse_public_scenes (TASK-6.3)
    if search and search.strip():
        query = query.where(Scene.title.ilike(f"%{search.strip()}%"))

    # Filters
    if nsfw == 'nsfw':
        query = query.where(Scene.is_nsfw == True)
    elif nsfw == 'sfw':
        query = query.where(Scene.is_nsfw == False)
    if tier:
        query = query.where(Scene.tier == tier)
    if game_mode:
        query = query.where(Scene.game_mode == game_mode)

    # Sort
    if sort == 'most_played':
        query = query.order_by(Scene.play_count.desc().nulls_last(), Scene.created_at.desc())
    elif sort == 'newest':
        query = query.order_by(Scene.created_at.desc())
    elif sort == 'oldest':
        query = query.order_by(Scene.created_at.asc())

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    return [await _build_scene_response(s, db) for s in result.scalars().all()]
