# Centralized Pydantic settings loader for the Jikkei API.
import logging
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_LEGAL_MARKDOWN_DIR = Path(__file__).resolve().parents[3] / 'jikkei' / 'src' / 'content' / 'legal'


def _read_markdown_version(file_name: str) -> str:
    try:
        markdown = (_LEGAL_MARKDOWN_DIR / file_name).read_text(encoding='utf-8')
    except OSError:
        return 'v0.0.0'

    for line in markdown.splitlines():
        stripped = line.strip()
        if not stripped:
          continue
        if stripped.startswith('# '):
            version = stripped[2:].strip().split()[0]
            return version or 'v0.0.0'
        break

    return 'v0.0.0'


def _build_legal_bundle_version() -> str:
    terms_version = _read_markdown_version('terms.md')
    privacy_version = _read_markdown_version('privacy.md')
    return f'terms:{terms_version}|privacy:{privacy_version}'


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    FRONTEND_URL: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    SENTRY_DSN: str = ""
    # Dev-only: dumps the full system+dynamic prompt and message history to
    # logs on every turn. Defaults off — meant to be flipped on temporarily
    # while debugging retrieval/prompt issues, not left on in any deployed
    # environment (full player input ends up in logs verbatim at INFO level
    # when this is on).
    LOG_FULL_PROMPTS: bool = False

    # ── AI — Embeddings (OpenAI, optional) ───────────────────────
    OPENAI_API_KEY: str = ""
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    OPENROUTER_EMBEDDING_MODEL: str = "nvidia/llama-nemotron-embed-vl-1b-v2:free"
    OPENROUTER_EMBEDDING_FALLBACK_MODEL: str = "qwen/qwen3-embedding-8b"

    # ── AI — Embeddings primary (Google AI Studio, free) ───────────
    # text-embedding-004 — 768-dim, free tier, no credit card.
    # Get a key at https://aistudio.google.com/apikey
    GOOGLE_AI_STUDIO_API_KEY: str = ""
    NVIDIA_API_KEY: str = ""

    # ── AI — Dialogue, summarisation, premium fallback (OpenRouter) ─────────
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_DIALOGUE_MODEL: str = "google/gemini-2.5-flash"
    OPENROUTER_SUMMARISATION_MODEL: str = "meta-llama/llama-3.3-70b-instruct:free"
    OPENROUTER_SUMMARISATION_FALLBACK_MODEL: str = "qwen/qwen-2.5-7b-instruct:free"
    # Deprecated compatibility setting. Dialogue routing ignores this value;
    # free and premium always share the same model chain.
    OPENROUTER_PREMIUM_MODEL: str = ""
    OPENROUTER_BUDGET_FALLBACK_MODEL: str = "google/gemma-4-26b-a4b-it:free"
    OPENROUTER_TIMEOUT_SECONDS: float = 30.0
    OPENROUTER_MAX_RETRIES: int = 1

    # ── Cloudinary ─────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # ── OAuth — Google (provider #1; architecture is multi-provider-ready) ──
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/oauth/google/callback"

    # ── Cost safety caps ───────────────────────────────────
    MAX_TURNS_FREE_TIER: int = 100
    MAX_TURNS_PER_SESSION: int = 50
    # TASK-011: rolling-window credit model (replaces the old UTC-daily
    # reset). A window starts on first use and expires CREDIT_WINDOW_HOURS
    # later, at which point credits_remaining resets to the caller's tier
    # cap — see credit_service.py. Numbers are an experimental starting
    # point, not derived from final unit-economics math; expect to tune
    # after real usage data. Both tiers currently ride the same dialogue
    # model (direct Gemini 2.5 Flash) so cost/turn is identical regardless
    # of tier — premium's value-add here is purely a higher credit ceiling.
    CREDIT_WINDOW_HOURS: int = 5
    SESSION_CREDITS_FREE: int = 20
    SESSION_CREDITS_PREMIUM: int = 80
    MAX_UPLOAD_SIZE_MB: int = 5
    UPLOAD_ALLOWED_MIME_TYPES: str = "image/jpeg,image/png,image/webp"

    # TASK-011 (The Hub): coins awarded per daily-claim, separate currency
    # from the AI-turn credit system above (see user_game_profile.py).
    DAILY_COIN_AMOUNT: int = 20

    # Epic F4: direct-Gemini dialogue calls should fail fast into the
    # OpenRouter fallback rather than let a slow/stuck request hold the user
    # for up to a minute before run_ai_turn's except-block even triggers the
    # fallback. 20s is generous for a typical Flash-tier turn-generation call
    # but still gives up well before a player would call the app "frozen".
    GEMINI_DIRECT_TIMEOUT_SECONDS: float = 20.0
    TURN_CLAIM_TTL_SECONDS: int = 300

    # Epic H1: max session-only (personalized-mode) characters a single
    # session may have, gated by the user's effective tier (see
    # subscription_service.get_effective_tier). This caps additions made via
    # Personalized story edit specifically — it does NOT limit how many
    # template-derived characters a scene's author can add in Original mode
    # (that's governed elsewhere, unrelated to this tier check).
    MAX_SESSION_CHARACTERS_FREE: int = 2
    MAX_SESSION_CHARACTERS_PREMIUM: int = 4

    # ── Rate limiting ──────────────────────────────────────
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_REGISTER: str = "3/minute"
    RATE_LIMIT_REFRESH: str = "10/minute"
    RATE_LIMIT_AI_CHAT: str = "10/minute"

    LEGAL_VERSION: str = _build_legal_bundle_version()

    REDIS_URL: str = "redis://localhost:6379"
    RATELIMIT_STORAGE_URL: str = "memory://"

    # ── Stripe billing ───────────────────────────────────────
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    # Price IDs — one per sellable item. Add a line here whenever a new
    # Product/Price is created in Stripe; app/core/billing.py maps these
    # to what gets granted. Test-mode and live-mode price IDs differ, so
    # this value changes between environments via .env, never hardcoded.
    STRIPE_PRICE_PREMIUM_MONTHLY: str = ""

    @property
    def openrouter_api_key(self) -> str:
        return self.OPENROUTER_API_KEY

    @model_validator(mode='after')
    def validate_critical_config(self) -> 'Settings':
        """
        Fail fast on bad configuration.

        Why crash at startup: A misconfigured app that boots looks healthy
        to the load balancer and keeps accepting requests — but every JWT
        it signs is compromised if SECRET_KEY is weak. Crashing at startup
        forces the problem to be visible immediately instead of silently.
        """
        logger = logging.getLogger(__name__)

        if len(self.SECRET_KEY) < 32:
            raise ValueError(
                "SECRET_KEY too short. Generate with: "
                "python -c \"import secrets; print(secrets.token_hex(32))\""
            )

        _WEAK_KEYS = {
            "changeme", "secret", "password", "jikkei",
            "your-secret-key", "mysecretkey", "supersecret",
            "development", "test", "example",
        }
        if self.SECRET_KEY.lower() in _WEAK_KEYS:
            raise ValueError(
                "SECRET_KEY is a known-weak placeholder value. Regenerate it."
            )

        if self.ENVIRONMENT.lower() == "production":
            if not self.DATABASE_URL.startswith("postgresql"):
                raise ValueError("Production ENVIRONMENT requires a PostgreSQL DATABASE_URL")
            if not self.SENTRY_DSN:
                logger.warning("SENTRY_DSN is empty in production — errors won't be tracked")
            if not self.OPENROUTER_API_KEY:
                logger.warning("OPENROUTER_API_KEY is empty in production — AI dialogue may fail")

        if not self.CLOUDINARY_API_SECRET:
            logger.warning("CLOUDINARY_API_SECRET is empty — Cloudinary signed uploads may fail")

        if not self.GOOGLE_CLIENT_ID or not self.GOOGLE_CLIENT_SECRET:
            logger.warning("GOOGLE_CLIENT_ID/SECRET are empty — Google OAuth login will fail")

        return self

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / '.env',
        env_file_encoding='utf-8',
    )


settings = Settings()
