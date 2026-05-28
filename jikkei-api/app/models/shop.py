# SQLAlchemy models for the marketplace: purchasable items, user ownership,
# and the weekly per-user Night Market draw (TASK-12.1).
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, Text, func
from sqlalchemy import text as sa_text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ShopItem(Base):
    """One row per purchasable item or pack (background pack, dialogue skin, bundle)."""
    __tablename__ = "shop_items"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    item_type: Mapped[str] = mapped_column(Text, nullable=False)

    price_coins: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    price_gems: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    available_from: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    available_until: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=sa_text("true"))
    is_night_market_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sa_text("false"))

    # Column name in DB is "metadata"; attribute is metadata_ since Base reserves .metadata
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
        default=dict,
        server_default=sa_text("'{}'"),
    )
    rarity: Mapped[str] = mapped_column(Text, nullable=False, default="common", server_default=sa_text("'common'"))

    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now(), default=lambda: datetime.now(timezone.utc))


class UserInventory(Base):
    """What each user owns. A user can own each shop item only once (UNIQUE constraint)."""
    __tablename__ = "user_inventory"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shop_item_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shop_items.id", ondelete="CASCADE"), nullable=False)
    acquired_via: Mapped[str] = mapped_column(Text, nullable=False)
    acquired_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))
    # For pack ownership: set on individual items granted by a pack purchase
    source_pack_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("shop_items.id", ondelete="SET NULL"), nullable=True)


class NightMarketWeekly(Base):
    """The server-side weekly secret-box draw, one row per user per week."""
    __tablename__ = "night_market_weekly"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # Always Monday 00:00 Vietnam time (UTC+7), stored as UTC Sunday 17:00
    week_start: Mapped[datetime] = mapped_column(nullable=False)
    slots: Mapped[list[Any]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))
