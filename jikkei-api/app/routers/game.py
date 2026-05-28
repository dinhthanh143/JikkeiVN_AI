# Gamification (Hub) routes -- currency profile + daily claim.
# Registered under prefix "/api" in main.py, matching every other feature
# router (credits, scenes, users) -- NOT a standalone "/game" root.
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.game import DailyClaimResponse, UserGameProfileResponse
from app.services.game_service import claim_daily_reward, get_or_create_game_profile

router = APIRouter(tags=["game"])


@router.get("/game/profile", response_model=UserGameProfileResponse)
async def get_game_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserGameProfileResponse:
    profile = await get_or_create_game_profile(current_user.id, db)
    return UserGameProfileResponse.model_validate(profile)


@router.post("/game/daily/claim", response_model=DailyClaimResponse)
async def claim_daily(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DailyClaimResponse:
    profile, awarded = await claim_daily_reward(current_user.id, db)
    return DailyClaimResponse(
        success=True,
        coins_awarded=awarded,
        new_coin_balance=profile.coins,
        next_claimable_at=profile.last_daily_claimed_at + timedelta(hours=24),
        message=f"+{awarded} coins claimed!",
    )
