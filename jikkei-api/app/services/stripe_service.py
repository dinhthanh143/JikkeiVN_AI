
# Uses the StripeClient class (SDK v8+) with _async-suffixed methods, since
# the rest of this backend is fully async (asyncpg). See
# https://github.com/stripe/stripe-python for the pattern.
from uuid import UUID

import stripe
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.billing import get_price_grant
from app.core.config import settings
from app.models.billing import StripeCustomer
from app.models.user import User

_client = stripe.StripeClient(settings.STRIPE_SECRET_KEY)


async def _fetch_stripe_customer(user_id: UUID, db: AsyncSession) -> StripeCustomer | None:
    result = await db.execute(select(StripeCustomer).where(StripeCustomer.user_id == user_id))
    return result.scalar_one_or_none()


async def get_or_create_customer(user: User, db: AsyncSession) -> StripeCustomer:
    """
    Return this user's Stripe customer mapping, creating both the Stripe-side
    Customer object and our local `stripe_customers` row on first purchase.

    Checks our DB first rather than Stripe — cheaper, and it's the source of
    truth for "does this user already have a Stripe customer" from our side.
    """
    existing = await _fetch_stripe_customer(user.id, db)
    if existing is not None:
        return existing

    stripe_customer = await _client.v1.customers.create_async(
        params={
            "email": user.email,
            "metadata": {"user_id": str(user.id)},
        }
    )

    row = StripeCustomer(user_id=user.id, stripe_customer_id=stripe_customer.id)
    db.add(row)
    try:
        await db.commit()
        await db.refresh(row)
    except IntegrityError:
        # Concurrent first-purchase requests (e.g. double-click) can race on
        # the unique user_id constraint. Whoever lost the race just reads
        # back the winner's row rather than erroring out — and yes, this
        # means we may orphan one Stripe Customer object on Stripe's side
        # in the rare race case. Harmless (no charge attached to it yet)
        # and cheaper than adding distributed locking for a one-in-a-million
        # double-click.
        await db.rollback()
        row = await _fetch_stripe_customer(user.id, db)
        if row is None:
            raise
    return row


async def create_checkout_session(user: User, price_id: str, db: AsyncSession) -> stripe.checkout.Session:
    """
    Create a Stripe Checkout Session for the given price.

    Rejects any price_id not present in PRICE_MAP — never trust a
    client-supplied price_id blindly and pass it straight to Stripe. A
    client could otherwise send an arbitrary valid Stripe price_id (e.g. one
    belonging to a different, unlaunched product) and get charged/granted
    something we never intended to sell through this endpoint.
    """
    grant = get_price_grant(price_id)
    if grant is None:
        raise ValueError(f"Unknown price_id: {price_id}")

    customer = await get_or_create_customer(user, db)
    mode = "subscription" if grant["type"] == "subscription" else "payment"

    session = await _client.v1.checkout.sessions.create_async(
        params={
            "customer": customer.stripe_customer_id,
            "mode": mode,
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": f"{settings.FRONTEND_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{settings.FRONTEND_URL}/billing/cancel",
            # price_id is required here: checkout.session.completed webhook
            # events don't include line items by default, and calling Stripe
            # again from inside the webhook to fetch them just adds latency
            # and another failure point. user_id is belt-and-suspenders —
            # the webhook actually resolves the user via stripe_customers,
            # but having it here too means a support lookup needs no extra call.
            "metadata": {"user_id": str(user.id), "price_id": price_id},
        }
    )
    return session


async def create_portal_session(user: User, db: AsyncSession) -> stripe.billing_portal.Session:
    """
    Create a Stripe Customer Portal session so the user can manage or cancel
    their own subscription without us building that UI ourselves.
    """
    customer = await get_or_create_customer(user, db)
    portal = await _client.v1.billing_portal.sessions.create_async(
        params={
            "customer": customer.stripe_customer_id,
            "return_url": f"{settings.FRONTEND_URL}/settings/billing",
        }
    )
    return portal
