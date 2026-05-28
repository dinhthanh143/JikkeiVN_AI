# SQLAlchemy models for users and refresh tokens — production hardened.
from datetime import date, datetime, timezone
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# Default shape for User.settings — keep in sync with the DB column default.
# Any key added here is auto-backfilled by settings_service.get_or_create_settings()
# for rows that predate the new field (no migration required for additive changes).
DEFAULT_USER_SETTINGS: dict = {
    "sfx_volume": 80,
    "bgm_volume": 80,
    "sfx_enabled": True,
    "bgm_enabled": True,
    "auto_play": False,
    "language": "en",
    "text_sfx_enabled": True,
    "text_sfx_volume": 60,
    "text_sfx_type": 1,
}


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("idx_users_oauth", "oauth_provider", "oauth_provider_id", unique=True),
    )

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    # OAuth-only accounts have no password — they prove identity via their provider each login.
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user", server_default="user")
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    profile_banner: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # "google", "discord", etc. Null for password-based accounts.
    oauth_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # The provider's stable user ID (Google's `sub`, Discord's user ID, etc.). Null for password accounts.
    oauth_provider_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(), default=lambda: datetime.now(timezone.utc)
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))

    agreed_to_latest_legal: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false"),
    )
    legal_version_accepted: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # TASK-13.1 — admin activity monitoring. last_login_at stamped in
    # _issue_login_session (every login path); last_seen_at stamped on every
    # /auth/refresh (silent token rotation, ~every 30 min while the app is
    # open) — the better signal for "inactive for N days" since it reflects
    # real usage, not just session creation. Both nullable: NULL means the
    # event has never occurred.
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Player preferences — single jsonb blob, backfilled by settings_service.
    # New keys are additive: add to DEFAULT_USER_SETTINGS + schemas, no migration needed.
    settings: Mapped[dict] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
        default=lambda: dict(DEFAULT_USER_SETTINGS),
        server_default=text(
            "'{\"sfx_volume\":80,\"bgm_volume\":80,"
            "\"sfx_enabled\":true,\"bgm_enabled\":true,"
            "\"auto_play\":false,\"language\":\"en\","
            "\"text_sfx_enabled\":true,\"text_sfx_volume\":60,"
            "\"text_sfx_type\":1}'"
        ),
    )

    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True,
    )
    consents: Mapped[List["UserConsent"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True,
    )


class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan: Mapped[str] = mapped_column(Text, nullable=False, default="free", server_default=text("'free'"))
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active", server_default=text("'active'"))
    provider: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    provider_subscription_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    current_period_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    trial_ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, server_default=func.now())


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc)
    )
    is_revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    token_family: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class UserConsent(Base):
    __tablename__ = "user_consents"
    __table_args__ = (
        Index("idx_user_consents_user_version", "user_id", "terms_version"),
    )

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    terms_version: Mapped[str] = mapped_column(String(64), nullable=False)
    agreed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc),
    )
    ip_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(back_populates="consents")
