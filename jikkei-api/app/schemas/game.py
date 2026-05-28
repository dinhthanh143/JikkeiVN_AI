# Pydantic schemas for the gamification (Hub) endpoints -- user_game_profile
# currency + daily claim. Kept in their own file since this domain is
# distinct from scene.py's authoring/gameplay schemas.
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class GameSchemaBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserGameProfileResponse(GameSchemaBase):
    user_id: UUID
    coins: int
    gems: int
    last_daily_claimed_at: datetime | None


class DailyClaimResponse(GameSchemaBase):
    success: bool
    coins_awarded: int
    new_coin_balance: int
    next_claimable_at: datetime   # exactly 24h after claim time, for frontend countdown
    message: str
