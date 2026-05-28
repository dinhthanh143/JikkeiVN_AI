from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.scene import CreditsResponse
from app.services.credit_service import get_or_create_credits
from app.services.subscription_service import get_effective_tier

router = APIRouter(tags=["credits"])


@router.get("/credits", response_model=CreditsResponse)
async def get_credits(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CreditsResponse:
    credits = await get_or_create_credits(current_user.id, db)
    tier = await get_effective_tier(current_user.id, db)
    session_cap = settings.SESSION_CREDITS_PREMIUM if tier == "premium" else settings.SESSION_CREDITS_FREE
    resets_at = (
        credits.window_started_at + timedelta(hours=settings.CREDIT_WINDOW_HOURS)
        if credits.window_started_at is not None
        else None
    )
    return CreditsResponse(
        credits_remaining=credits.credits_remaining,
        credits_lifetime_used=credits.credits_lifetime_used,
        window_started_at=credits.window_started_at,
        resets_at=resets_at,
        session_cap=session_cap,
    )
