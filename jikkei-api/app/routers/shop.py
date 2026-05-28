# Marketplace routes -- shop browsing, night market (weekly per-user draw),
# and inventory. Registered under prefix "/api" in main.py, matching every
# other feature router (game, credits, scenes, users).
from datetime import datetime, timedelta, timezone
import random

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.shop import NightMarketWeekly, ShopItem, UserInventory
from app.models.user import User
from app.schemas.shop import (
    NightMarketResponse,
    NightMarketSlot,
    ShopItemResponse,
    UserInventoryResponse,
)

router = APIRouter(tags=["shop"])

# ── Helpers ──────────────────────────────────────────────────────────────────

def current_week_start() -> datetime:
    """
    Monday 00:00 Vietnam time (UTC+7) expressed as UTC datetime.
    = Sunday 17:00 UTC of the same calendar week.
    """
    now_utc = datetime.now(timezone.utc)
    days_since_monday_vn = (now_utc.weekday() + 1) % 7  # 0 = Sunday, 1 = Monday, ...
    sunday_utc = now_utc - timedelta(days=days_since_monday_vn)
    week_start = sunday_utc.replace(hour=17, minute=0, second=0, microsecond=0)
    if week_start > now_utc:
        week_start -= timedelta(days=7)
    return week_start


def next_week_start() -> datetime:
    return current_week_start() + timedelta(days=7)


async def _hydrate_slot(db: AsyncSession, slot_data: dict) -> NightMarketSlot:
    item = None
    if slot_data.get("shop_item_id"):
        result = await db.execute(select(ShopItem).where(ShopItem.id == slot_data["shop_item_id"]))
        raw_item = result.scalar_one_or_none()
        if raw_item:
            item = ShopItemResponse.from_orm_item(raw_item)
    return NightMarketSlot(
        slot_index=slot_data["slot_index"],
        shop_item_id=slot_data.get("shop_item_id"),
        discount_pct=slot_data["discount_pct"],
        is_night_market_only=slot_data["is_night_market_only"],
        is_revealed=slot_data["is_revealed"],
        is_purchased=slot_data["is_purchased"],
        item=item,
    )


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/shop/items", response_model=list[ShopItemResponse])
async def browse_shop_items(
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None, max_length=100),
    item_type: str | None = Query(None, pattern="^(background_pack|dialogue_skin|bundle)$"),
    rarity: str | None = Query(None, pattern="^(common|rare|epic|legendary)$"),
    sort: str = Query("price_asc", pattern="^(price_asc|price_desc|newest|rarity)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> list[ShopItemResponse]:
    """Browse all active, currently available shop items. Server-side search/filter/sort/pagination."""
    now = datetime.now(timezone.utc)
    query = select(ShopItem).where(
        ShopItem.is_active == True,  # noqa: E712
        or_(ShopItem.available_from.is_(None), ShopItem.available_from <= now),
        or_(ShopItem.available_until.is_(None), ShopItem.available_until >= now),
    )
    if search and search.strip():
        query = query.where(ShopItem.name.ilike(f"%{search.strip()}%"))
    if item_type:
        query = query.where(ShopItem.item_type == item_type)
    if rarity:
        query = query.where(ShopItem.rarity == rarity)

    if sort == "price_asc":
        query = query.order_by(ShopItem.price_coins.asc().nulls_last(), ShopItem.price_gems.asc().nulls_last())
    elif sort == "price_desc":
        query = query.order_by(ShopItem.price_coins.desc().nulls_first(), ShopItem.price_gems.desc().nulls_first())
    elif sort == "newest":
        query = query.order_by(ShopItem.created_at.desc())
    elif sort == "rarity":
        rarity_order = {"legendary": 0, "epic": 1, "rare": 2, "common": 3}
        query = query.order_by(case(rarity_order, value=ShopItem.rarity).asc())

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return [ShopItemResponse.from_orm_item(item) for item in result.scalars().all()]


@router.get("/shop/night-market", response_model=NightMarketResponse)
async def get_night_market(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NightMarketResponse:
    """
    Return this user's current night market slots. If no row exists for this
    week, generate a new random draw from night_market_eligible, unowned items.
    """
    week_start = current_week_start()

    result = await db.execute(
        select(NightMarketWeekly).where(
            NightMarketWeekly.user_id == current_user.id,
            NightMarketWeekly.week_start == week_start,
        )
    )
    nm = result.scalar_one_or_none()

    if nm is None:
        eligible_result = await db.execute(
            select(ShopItem).where(
                ShopItem.is_active == True,  # noqa: E712
                ShopItem.is_night_market_eligible == True,  # noqa: E712
            )
        )
        eligible_items = eligible_result.scalars().all()

        owned_result = await db.execute(
            select(UserInventory.shop_item_id).where(UserInventory.user_id == current_user.id)
        )
        owned_ids = {row[0] for row in owned_result.all()}

        pool = [item for item in eligible_items if item.id not in owned_ids]
        random.shuffle(pool)
        selected = pool[:5]

        slots = []
        for i in range(5):
            if i < len(selected):
                item = selected[i]
                discount = random.choice([20, 25, 30, 35, 40, 45, 50])
                slots.append({
                    "slot_index": i,
                    "shop_item_id": str(item.id),
                    "discount_pct": discount,
                    "is_night_market_only": False,
                    "is_revealed": False,
                    "is_purchased": False,
                })
            else:
                slots.append({
                    "slot_index": i,
                    "shop_item_id": None,
                    "discount_pct": 0,
                    "is_night_market_only": False,
                    "is_revealed": False,
                    "is_purchased": False,
                })

        nm = NightMarketWeekly(user_id=current_user.id, week_start=week_start, slots=slots)
        db.add(nm)
        await db.commit()
        await db.refresh(nm)

    hydrated_slots = [await _hydrate_slot(db, slot_data) for slot_data in nm.slots]
    return NightMarketResponse(week_start=week_start, next_reset=next_week_start(), slots=hydrated_slots)


@router.post("/shop/night-market/{slot_index}/reveal", response_model=NightMarketSlot)
async def reveal_night_market_slot(
    slot_index: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NightMarketSlot:
    """Flip a secret box -- mark slot as revealed. Returns the slot with item hydrated."""
    week_start = current_week_start()
    result = await db.execute(
        select(NightMarketWeekly).where(
            NightMarketWeekly.user_id == current_user.id,
            NightMarketWeekly.week_start == week_start,
        )
    )
    nm = result.scalar_one_or_none()
    if nm is None or slot_index < 0 or slot_index >= len(nm.slots):
        raise HTTPException(status_code=404, detail="Night market slot not found")

    slots = list(nm.slots)
    slot_data = dict(slots[slot_index])
    slot_data["is_revealed"] = True
    slots[slot_index] = slot_data
    nm.slots = slots
    await db.commit()

    return await _hydrate_slot(db, slot_data)


@router.get("/shop/inventory", response_model=list[UserInventoryResponse])
async def get_my_inventory(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserInventoryResponse]:
    result = await db.execute(select(UserInventory).where(UserInventory.user_id == current_user.id))
    return result.scalars().all()
