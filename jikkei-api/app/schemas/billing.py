# Pydantic schemas for billing (checkout, portal, transaction history).
# Mirrors shop.py's style — one schema file per feature domain.
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CheckoutRequest(BaseModel):
    price_id: str


class CheckoutResponse(BaseModel):
    checkout_url: str


class PortalResponse(BaseModel):
    portal_url: str


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str
    status: str
    amount: int
    currency: str
    granted_coins: int
    granted_gems: int
    created_at: datetime
