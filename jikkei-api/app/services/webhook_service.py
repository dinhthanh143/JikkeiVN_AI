# Webhook event handlers. Each function stages DB changes via db.add()/
# attribute mutation but does NOT commit — the router commits everything
# for one event (grant + the stripe_webhook_events idempotency row) in a
# single transaction, so a crash mid-processing can't leave the grant
# applied without the idempotency guard (which would let a Stripe retry
# double-apply it), or vice versa (silently swallowing a real payment).
#
# IMPORTANT — Stripe's returned objects are StripeObject instances, not
# plain dicts: obj.field and obj["field"] both work, but obj.get(...) does
# NOT — it tries to look up a field literally named "get" and raises
# AttributeError. Verified directly against the installed SDK. Always use
# getattr(obj, "field", default) here, never .get().
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from stripe import Event

from app.core.billing import get_price_grant
from app.models.billing import StripeCustomer, Transaction
from app.models.user import UserSubscription

logger = logging.getLogger(__name__)


async def _resolve_user_id(customer_id: str | None, db: AsyncSession) -> UUID | None:
    """Resolve a user via OUR stripe_customers table, not via event
    metadata — this mapping always exists for any customer/checkout we
    created ourselves, so it's the more robust source of truth."""
    if not customer_id:
        return None
    result = await db.execute(
        select(StripeCustomer.user_id).where(StripeCustomer.stripe_customer_id == customer_id)
    )
    return result.scalar_one_or_none()


async def _get_or_create_subscription(user_id: UUID, db: AsyncSession) -> UserSubscription:
    result = await db.execute(select(UserSubscription).where(UserSubscription.user_id == user_id))
    sub = result.scalar_one_or_none()
    if sub is None:
        sub = UserSubscription(user_id=user_id)
        db.add(sub)
    return sub


async def _handle_checkout_completed(event: Event, db: AsyncSession) -> None:
    session = event.data.object
    customer_id = getattr(session, "customer", None)
    metadata = getattr(session, "metadata", None)
    price_id = getattr(metadata, "price_id", None) if metadata else None

    if not customer_id or not price_id:
        logger.error("checkout.session.completed %s: missing customer or price_id metadata", event.id)
        return

    user_id = await _resolve_user_id(customer_id, db)
    if user_id is None:
        logger.error("checkout.session.completed %s: no stripe_customers row for %s", event.id, customer_id)
        return

    grant = get_price_grant(price_id)
    if grant is None:
        logger.error("checkout.session.completed %s: unknown price_id %s", event.id, price_id)
        return

    granted_coins = 0
    granted_gems = 0

    if grant["type"] == "subscription":
        sub = await _get_or_create_subscription(user_id, db)
        sub.plan = grant["plan_tier"]
        sub.status = "active"
        sub.provider = "stripe"
        sub.provider_subscription_id = getattr(session, "subscription", None)
        txn_type = "subscription_purchase"
        # current_period_start/end intentionally left untouched here —
        # invoice.paid fires right after this for every new subscription
        # and is the authoritative source for period dates (it has the
        # real billing period; this event doesn't).
    else:
        # coin_pack / gem_pack: not implemented yet — PRICE_MAP has no
        # entries of this type today. Logged loudly rather than silently
        # doing nothing, so a real payment is never invisible even if
        # grant application lags behind adding the product.
        logger.error(
            "checkout.session.completed %s: grant type %s not yet implemented, nothing granted",
            event.id, grant["type"],
        )
        txn_type = grant["type"]

    db.add(Transaction(
        user_id=user_id,
        stripe_customer_id=customer_id,
        stripe_price_id=price_id,
        type=txn_type,
        stripe_checkout_session_id=getattr(session, "id", None),
        stripe_payment_intent_id=getattr(session, "payment_intent", None),
        amount=getattr(session, "amount_total", None) or 0,
        currency=getattr(session, "currency", None) or "usd",
        status="succeeded",
        granted_coins=granted_coins,
        granted_gems=granted_gems,
    ))


async def _handle_invoice_paid(event: Event, db: AsyncSession) -> None:
    invoice = event.data.object
    customer_id = getattr(invoice, "customer", None)
    billing_reason = getattr(invoice, "billing_reason", None)

    user_id = await _resolve_user_id(customer_id, db)
    if user_id is None:
        logger.error("invoice.paid %s: no stripe_customers row for %s", event.id, customer_id)
        return

    lines_obj = getattr(invoice, "lines", None)
    lines = getattr(lines_obj, "data", []) if lines_obj else []
    price_id = None
    period_start = period_end = None
    if lines:
        line = lines[0]
        price_obj = getattr(line, "price", None)
        price_id = getattr(price_obj, "id", None) if price_obj else None
        period = getattr(line, "period", None)
        if period:
            start_ts = getattr(period, "start", None)
            end_ts = getattr(period, "end", None)
            if start_ts:
                period_start = datetime.fromtimestamp(start_ts, tz=timezone.utc)
            if end_ts:
                period_end = datetime.fromtimestamp(end_ts, tz=timezone.utc)

    sub = await _get_or_create_subscription(user_id, db)
    # NOTE: hardcoded to "premium" since it's the only plan sold today.
    # Revisit (derive from price_id via get_price_grant) if a second
    # subscription tier ships.
    sub.plan = "premium"
    sub.status = "active"
    sub.provider = "stripe"
    sub.provider_subscription_id = getattr(invoice, "subscription", None)
    if period_start is not None:
        sub.current_period_start = period_start
    if period_end is not None:
        sub.current_period_end = period_end

    # The first invoice for a brand-new subscription (billing_reason ==
    # "subscription_create") is already logged as a subscription_purchase
    # transaction by checkout.session.completed — don't double-log it here.
    if billing_reason == "subscription_cycle":
        db.add(Transaction(
            user_id=user_id,
            stripe_customer_id=customer_id,
            stripe_price_id=price_id,
            type="subscription_renewal",
            stripe_invoice_id=getattr(invoice, "id", None),
            amount=getattr(invoice, "amount_paid", None) or 0,
            currency=getattr(invoice, "currency", None) or "usd",
            status="succeeded",
        ))


async def _handle_invoice_payment_failed(event: Event, db: AsyncSession) -> None:
    invoice = event.data.object
    customer_id = getattr(invoice, "customer", None)

    user_id = await _resolve_user_id(customer_id, db)
    if user_id is None:
        logger.error("invoice.payment_failed %s: no stripe_customers row for %s", event.id, customer_id)
        return

    result = await db.execute(select(UserSubscription).where(UserSubscription.user_id == user_id))
    sub = result.scalar_one_or_none()
    if sub is not None:
        sub.status = "past_due"

    db.add(Transaction(
        user_id=user_id,
        stripe_customer_id=customer_id,
        type="subscription_renewal",
        stripe_invoice_id=getattr(invoice, "id", None),
        amount=getattr(invoice, "amount_due", None) or 0,
        currency=getattr(invoice, "currency", None) or "usd",
        status="failed",
    ))


async def _handle_subscription_deleted(event: Event, db: AsyncSession) -> None:
    subscription = event.data.object
    customer_id = getattr(subscription, "customer", None)

    user_id = await _resolve_user_id(customer_id, db)
    if user_id is None:
        logger.error("customer.subscription.deleted %s: no stripe_customers row for %s", event.id, customer_id)
        return

    result = await db.execute(select(UserSubscription).where(UserSubscription.user_id == user_id))
    sub = result.scalar_one_or_none()
    if sub is not None:
        sub.status = "cancelled"
        sub.plan = "free"


_EVENT_HANDLERS = {
    "checkout.session.completed": _handle_checkout_completed,
    "invoice.paid": _handle_invoice_paid,
    "invoice.payment_failed": _handle_invoice_payment_failed,
    "customer.subscription.deleted": _handle_subscription_deleted,
}


async def process_webhook_event(event: Event, db: AsyncSession) -> None:
    """Dispatch to the right handler. Unrecognized event types are silently
    ignored — Stripe sends many event types we never subscribed to caring
    about; only the ones in _EVENT_HANDLERS require action from us."""
    handler = _EVENT_HANDLERS.get(event.type)
    if handler is not None:
        await handler(event, db)
