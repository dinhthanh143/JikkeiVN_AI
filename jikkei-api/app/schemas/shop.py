# Pydantic schemas for the marketplace (shop_items, user_inventory,
# night_market_weekly). Kept in their own file, mirrors game.py's style.
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ShopSchemaBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ShopItemResponse(ShopSchemaBase):
    id: UUID
    name: str
    description: str | None
    item_type: str
    price_coins: int | None
    price_gems: int | None
    available_from: datetime | None
    available_until: datetime | None
    is_active: bool
    rarity: str
    metadata: dict[str, Any]   # mapped from ORM's metadata_ column

    @classmethod
    def from_orm_item(cls, item: Any) -> "ShopItemResponse":
        return cls(
            id=item.id,
            name=item.name,
            description=item.description,
            item_type=item.item_type,
            price_coins=item.price_coins,
            price_gems=item.price_gems,
            available_from=item.available_from,
            available_until=item.available_until,
            is_active=item.is_active,
            rarity=item.rarity,
            metadata=item.metadata_,
        )


class NightMarketSlot(BaseModel):
    slot_index: int
    shop_item_id: UUID | None
    discount_pct: int
    is_night_market_only: bool
    is_revealed: bool
    is_purchased: bool
    item: ShopItemResponse | None = None   # populated when returning to frontend


class NightMarketResponse(BaseModel):
    week_start: datetime
    next_reset: datetime
    slots: list[NightMarketSlot]


class UserInventoryResponse(ShopSchemaBase):
    id: UUID
    shop_item_id: UUID
    acquired_via: str
    acquired_at: datetime
    source_pack_id: UUID | None
