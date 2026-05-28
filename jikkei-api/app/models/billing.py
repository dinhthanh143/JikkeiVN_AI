# SQLAlchemy models for Stripe billing — TASK-014.
# Mirrors the stripe_customers / transactions / stripe_webhook_events tables
# created by the add_stripe_billing_tables migration. See database-schema.md
# for the full column reference and the reasoning behind what's NOT here
# (no products table — price→grant mapping lives in app/core/billing.py).
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy import text as sa_text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class StripeCustomer(Base):
    """1:1 mapping between our users and Stripe Customer objects."""
    __tablename__ = "stripe_customers"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    stripe_customer_id: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))


class Transaction(Base):
    """Ledger of every Stripe payment attempt — the billing/purchase history
    shown to the user. user_subscriptions stays the current-state snapshot;
    this table is the append-only history."""
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint(
            "type IN ('subscription_purchase','subscription_renewal','coin_pack','gem_pack','refund')",
            name="transactions_type_check",
        ),
        CheckConstraint(
            "status IN ('pending','succeeded','failed','refunded')",
            name="transactions_status_check",
        ),
    )

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    stripe_customer_id: Mapped[str] = mapped_column(Text, nullable=False)
    stripe_price_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    stripe_checkout_session_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stripe_payment_intent_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stripe_invoice_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="usd", server_default=sa_text("'usd'"))
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending", server_default=sa_text("'pending'"))
    granted_coins: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=sa_text("0"))
    granted_gems: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=sa_text("0"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(), default=lambda: datetime.now(timezone.utc))


class StripeWebhookEvent(Base):
    """Webhook idempotency guard. Stripe redelivers events — every webhook
    handler must check stripe_event_id here before processing, or
    currency/subscription grants can be double-applied. No RLS policies
    (see migration): service-role/backend access only, never exposed to
    clients."""
    __tablename__ = "stripe_webhook_events"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    stripe_event_id: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))
    payload: Mapped[Optional[dict]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=True
    )
