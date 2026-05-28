# SQLAlchemy model for per-user gamification state (currency + daily claim).
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import ForeignKey, Integer, func
from sqlalchemy import text as sa_text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserGameProfile(Base):
    """
    One row per user. Distinct from UserCredits (AI-turn budget, resets on a
    rolling window) -- this is player-facing currency (coins/gems) plus
    daily-login tracking, extensible for future gacha/quest columns.
    """
    __tablename__ = "user_game_profile"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)

    coins: Mapped[int] = mapped_column(Integer, nullable=False, default=50, server_default=sa_text("50"))
    gems: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=sa_text("0"))

    last_daily_claimed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now(), default=lambda: datetime.now(timezone.utc))
