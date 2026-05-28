# Maps Stripe Price IDs to what they grant. Single source of truth for
# checkout session creation and webhook handling — both read through this,
# so there's exactly one place that knows "this price = this grant".
#
# Add a new entry whenever a Product/Price is created in the Stripe
# Dashboard. No DB table for this on purpose: it's a handful of rows that
# only change when pricing changes, not a query need — see database-schema.md
# for the transactions/stripe_customers/stripe_webhook_events tables that
# actually do need to be queryable.

from app.core.config import settings


PRICE_MAP: dict[str, dict] = {
    settings.STRIPE_PRICE_PREMIUM_MONTHLY: {
        "type": "subscription",
        "plan_tier": "premium",
    },
    # Next up, e.g.:
    # settings.STRIPE_PRICE_GEM_PACK_500: {
    #     "type": "gem_pack",
    #     "gems": 500,
    # },
}


def get_price_grant(stripe_price_id: str) -> dict | None:
    """Look up what a Stripe price grants. Returns None for unknown prices —
    callers must treat that as a hard error (reject/log), never guess."""
    return PRICE_MAP.get(stripe_price_id)
