# Checkout, billing-portal, transaction-history, and webhook routes.
# Registered under prefix "/api" in main.py, matching every other feature router.
import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.billing import StripeWebhookEvent, Transaction
from app.models.user import User
from app.schemas.billing import CheckoutRequest, CheckoutResponse, PortalResponse, TransactionResponse
from app.services.stripe_service import create_checkout_session, create_portal_session
from app.services.webhook_service import process_webhook_event

logger = logging.getLogger(__name__)
router = APIRouter(tags=["billing"])


@router.post("/billing/checkout-session", response_model=CheckoutResponse)
async def start_checkout(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckoutResponse:
    """
    Create a Stripe Checkout Session for the requested price and return its
    hosted URL. The frontend redirects the browser there directly — no card
    data ever passes through our backend.
    """
    try:
        session = await create_checkout_session(current_user, body.price_id, db)
    except ValueError as exc:
        # Unknown price_id — see stripe_service.create_checkout_session's
        # PRICE_MAP check. 400, not 500: this is a bad request, not a server fault.
        raise HTTPException(status_code=400, detail=str(exc))

    if not session.url:
        raise HTTPException(status_code=502, detail="Stripe did not return a checkout URL")
    return CheckoutResponse(checkout_url=session.url)


@router.post("/billing/portal-session", response_model=PortalResponse)
async def start_portal_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PortalResponse:
    """Create a Stripe Customer Portal session for the current user to manage/cancel their own subscription."""
    portal = await create_portal_session(current_user, db)
    return PortalResponse(portal_url=portal.url)


@router.get("/billing/transactions", response_model=list[TransactionResponse])
async def get_my_transactions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> list[TransactionResponse]:
    """Paginated billing history for the current user, most recent first."""
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(Transaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return result.scalars().all()


@router.post("/billing/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Receives Stripe's server-to-server notifications. This is the ONLY
    place a payment actually takes effect (grants applied, subscription
    updated) — Checkout Sessions just redirect the browser, they don't
    tell us anything happened.

    Order matters and is deliberate:
    1. Verify signature FIRST — reject anything not actually from Stripe
       before touching the DB at all.
    2. Idempotency check BEFORE any side effect — Stripe redelivers events
       (network hiccups, slow responses), so without this a retry would
       double-grant currency or re-extend a subscription.
    3. Everything for one event (the grant + the idempotency-log row)
       commits in a single transaction, so a crash mid-processing can't
       leave one written without the other.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    existing = await db.execute(
        select(StripeWebhookEvent).where(StripeWebhookEvent.stripe_event_id == event.id)
    )
    if existing.scalar_one_or_none() is not None:
        return {"status": "already_processed"}

    try:
        await process_webhook_event(event, db)
    except Exception:
        await db.rollback()
        logger.exception("Webhook processing failed for event %s (%s)", event.id, event.type)
        # 500 tells Stripe to retry later — correct behavior for a transient
        # DB error. Nothing was committed above, so a retry is safe.
        raise HTTPException(status_code=500, detail="Webhook processing failed")

    db.add(StripeWebhookEvent(stripe_event_id=event.id, event_type=event.type, payload=event.to_dict()))
    await db.commit()

    return {"status": "ok"}
