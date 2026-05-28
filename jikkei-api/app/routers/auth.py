"""
Authentication routes — production hardened.

Security model:
  - Passwords: bcrypt (cost factor 12) — never stored plain
  - Access tokens: JWT HS256, 30min TTL, httpOnly cookie
  - Refresh tokens: random 64-byte, SHA-256 hashed in DB, 7-day TTL
  - Token families: group tokens per login session for theft detection
  - Rate limiting: per-IP via slowapi + Redis
  - Timing safety: bcrypt always runs, even for missing users
  - Cookie scope: refresh token restricted to /auth/refresh path only
  - OAuth pending registration: brand-new Google identities are held in a
    signed, short-lived JWT cookie (not the DB) until the user picks a
    username and submits /auth/oauth/complete. Nothing is written to
    `users` until that happens.
"""

import logging
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_typed_token,
    decode_typed_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.dependencies import get_current_user
from app.main import limiter
from app.models.user import RefreshToken, User, UserConsent
from app.models.scene import UserCredits
from app.models.user_game_profile import UserGameProfile
from app.services.subscription_service import get_effective_tier
from app.services.settings_service import get_or_create_settings, update_settings
from app.schemas.auth import (
    LegalConsentRequest,
    LegalConsentStatusResponse,
    LoginRequest,
    OAuthCompleteRegistrationRequest,
    OAuthPendingInfoResponse,
    RegisterRequest,
    UserPrivateResponse,
    UserPublicResponse,
    UserSettingsResponse,
    UserSettingsUpdateRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Dummy hash used in timing-safe login to ensure bcrypt always runs.
# Without this, a missing email returns in ~1ms vs ~100ms for wrong
# password — leaking which emails are registered (user enumeration).
_DUMMY_HASH = hash_password("timing-safe-dummy-password-never-matches")

# How long a "finish your Google signup" session stays valid before the
# person has to click "Continue with Google" again.
_OAUTH_PENDING_TTL_MINUTES = 10
_OAUTH_PENDING_TOKEN_TYPE = "oauth_pending"
_OAUTH_PENDING_COOKIE = "oauth_pending"
_OAUTH_PENDING_COOKIE_PATH = "/auth/oauth"


def _set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
) -> None:
    """
    Set both auth cookies with security attributes.

    access_token:
      - path="/" so it's sent with all API requests automatically
      - 30 minute TTL matches JWT expiry

    refresh_token:
      - path="/auth/refresh" ONLY — the browser will NOT send this
        cookie to any other endpoint. Minimizes the attack surface.
      - 7 day TTL for good UX (stay logged in across sessions)
    """
    is_production = settings.ENVIRONMENT.lower() == "production"

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        # Scoped to /auth/refresh only — never sent to other routes.
        path="/auth/refresh",
    )


def _clear_auth_cookies(response: Response) -> None:
    """
    Clear both cookies. Must match exact path used when setting them,
    otherwise the browser ignores the delete instruction.
    """
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/auth/refresh")


async def _cleanup_expired_tokens(user_id: uuid.UUID, db: AsyncSession) -> None:
    """Delete expired refresh tokens for this user from the database."""
    await db.execute(
        delete(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.expires_at < datetime.now(timezone.utc),
        )
    )
    await db.commit()


async def _suggest_username(base: str, db: AsyncSession) -> str:
    """Sanitize a display name into a url-safe candidate, appending a digit
    suffix until we land on one that isn't taken. Same logic used for both
    the pending-info preview and the final complete-registration insert —
    kept as a shared helper so the two can't drift apart."""
    sanitized = re.sub(r"[^a-zA-Z0-9_-]", "", base)[:20] or "user"
    candidate = sanitized
    suffix = 1
    while (await db.execute(select(User).where(User.username == candidate))).scalar_one_or_none():
        candidate = f"{sanitized[:17]}{suffix}"
        suffix += 1
    return candidate


async def _issue_login_session(user: User, db: AsyncSession) -> tuple[str, str]:
    """Shared by /login, /oauth/google/callback (existing user), and
    /oauth/complete (freshly created user) — the exact same session
    machinery regardless of how identity was established."""
    await _cleanup_expired_tokens(user.id, db)
    token_family = str(uuid.uuid4())
    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    refresh_token_raw = create_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_token_raw),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_family=token_family,
    ))
    user.last_login_at = datetime.now(timezone.utc)
    user.last_seen_at = datetime.now(timezone.utc)
    await db.commit()
    return access_token, refresh_token_raw


@router.post("/register", response_model=UserPublicResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_REGISTER)
async def register(
    request: Request,
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> UserPublicResponse:
    """
    Create a new user account. Emails are treated case-insensitively.

    Also eagerly creates this user's user_credits row (daily AI-turn budget)
    and user_game_profile row (Hub currency: coins/gems, TASK-011) in the
    same transaction, so a brand-new account never has to lazily
    materialize either on first use. user_settings no longer needs this treatment —
    it's a jsonb column on users with a DB-level default, so it's always
    present the moment the row exists. user_subscriptions intentionally gets
    no row here: "no row" IS the free tier (see subscription_service).
    """
    normalized_email = payload.email.lower().strip()

    result = await db.execute(
        select(User).where(
            or_(User.email == normalized_email, User.username == payload.username)
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already taken",
        )

    user = User(
        email=normalized_email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
        role="user",
        display_name=payload.display_name or None,
        date_of_birth=payload.date_of_birth or None,
    )
    db.add(user)
    await db.flush()  # assign user.id without committing, so user_credits FK has a value

    db.add(UserCredits(
        user_id=user.id,
        credits_remaining=settings.FREE_DAILY_CREDITS,
        credits_lifetime_used=0,
    ))
    db.add(UserGameProfile(
        user_id=user.id,
        coins=50,
        gems=0,
    ))

    await db.commit()
    await db.refresh(user)

    logger.info("New user registered: %s", normalized_email)
    return UserPublicResponse.model_validate(user)


@router.post("/login", response_model=UserPublicResponse)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserPublicResponse:
    """Authenticate user and issue JWT access + refresh token pair."""
    normalized_email = payload.email.lower().strip() if payload.email else None
    normalized_username = payload.username.strip() if payload.username else None

    query_filters = []
    if normalized_email:
        query_filters.append(User.email == normalized_email)
    if normalized_username:
        query_filters.append(User.username == normalized_username)

    if not query_filters:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username must be provided",
        )

    result = await db.execute(select(User).where(*query_filters))
    user = result.scalar_one_or_none()

    # Always run bcrypt — even against dummy hash if user not found OR if
    # the user exists but has no password (OAuth-only account). Passing
    # None straight into bcrypt would raise, so we fall back to the dummy
    # hash in both cases — this keeps timing consistent across "no such
    # user" and "user has no password" instead of one being instant.
    stored_hash = user.hashed_password if (user and user.hashed_password) else _DUMMY_HASH
    password_valid = verify_password(payload.password, stored_hash)

    # OAuth-only account: there is genuinely no password to check against.
    # We deliberately tell them which provider to use instead of a generic
    # "invalid credentials" — see the account-linking discussion; this is
    # the common pattern (Slack, Notion, Linear all do this) because the
    # UX win outweighs the minor email-enumeration exposure here.
    if user and user.is_active and user.hashed_password is None:
        provider_label = (user.oauth_provider or "a third-party provider").capitalize()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'This account uses {provider_label} sign-in. Please use "Continue with {provider_label}" to log in.',
        )

    if not user or not user.is_active or not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if normalized_email and user.email != normalized_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if normalized_username and user.username != normalized_username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    access_token, refresh_token_raw = await _issue_login_session(user, db)
    _set_auth_cookies(response, access_token, refresh_token_raw)

    logger.info(
        "User logged in: %s | role=%s | request_id=%s",
        user.email,
        user.role,
        getattr(request.state, "request_id", "—"),
    )
    return UserPublicResponse.model_validate(user)


@router.get("/oauth/google/initiate")
async def google_oauth_initiate() -> RedirectResponse:
    """
    Redirect the user's browser to Google's OAuth consent page.

    We construct a URL with:
      - client_id: identifies our app to Google
      - redirect_uri: where Google sends the user back after consent
      - response_type=code: we want an authorization code (not a token directly)
      - scope: what data we want access to (openid = identity, email, profile = name)
      - prompt=select_account: forces account picker even if already signed in (better UX)
    """
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "prompt": "select_account",
    }
    google_auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return RedirectResponse(url=google_auth_url)


@router.get("/oauth/google/callback")
async def google_oauth_callback(
    code: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """
    Google redirected the user here with a short-lived authorization code.

    Step 1: Exchange the code for Google tokens (server-to-server POST to Google).
    Step 2: Use the access token to fetch the user's Google profile (email, name, sub).
    Step 3: Look up existing user by (oauth_provider, oauth_provider_id).
             If found -> log them in immediately, redirect to frontend home.
             If not found -> check if email exists (password user linking their Google).
               If email exists -> link the Google provider to that account, log them
                 in immediately (no new row is created, nothing to confirm).
               If email doesn't exist -> this is a BRAND NEW person. We do NOT touch
                 the users table yet. Instead we mint a short-lived signed cookie
                 holding their Google identity and send them to a "finish signup"
                 page on the frontend where they pick/confirm a username. The row
                 only gets created when they submit POST /auth/oauth/complete.
    """
    async with httpx.AsyncClient() as client:
        # Step 1: Exchange code for tokens
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange OAuth code")
        token_data = token_response.json()
        access_token_google = token_data.get("access_token")

        # Step 2: Fetch Google user profile
        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token_google}"},
        )
        if userinfo_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google user info")
        userinfo = userinfo_response.json()

    google_id = userinfo.get("id")          # Google's stable user ID (the "sub")
    google_email = userinfo.get("email", "").lower().strip()
    google_name = userinfo.get("name")      # full display name from Google profile

    if not google_id or not google_email:
        raise HTTPException(status_code=400, detail="Google did not return required user info")

    # Step 3a: already-linked Google account -> straight to login
    result = await db.execute(
        select(User).where(User.oauth_provider == "google", User.oauth_provider_id == google_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        # Step 3b: password account with the same email -> link, then log in
        result = await db.execute(select(User).where(User.email == google_email))
        user = result.scalar_one_or_none()
        if user:
            user.oauth_provider = "google"
            user.oauth_provider_id = google_id
            await db.commit()

    if user is not None:
        access_token, refresh_token_raw = await _issue_login_session(user, db)
        redirect = RedirectResponse(url=f"{settings.FRONTEND_URL}/", status_code=302)
        is_production = settings.ENVIRONMENT.lower() == "production"
        redirect.set_cookie("access_token", access_token, httponly=True, secure=is_production, samesite="lax", max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/")
        redirect.set_cookie("refresh_token", refresh_token_raw, httponly=True, secure=is_production, samesite="lax", max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60, path="/auth/refresh")
        return redirect

    # Step 3c: brand new person — do NOT create a row. Hand them a signed
    # "pending" token instead, scoped to /auth/oauth only, and send them to
    # the frontend's finish-signup page.
    pending_token = create_typed_token(
        {"provider": "google", "provider_id": google_id, "email": google_email, "name": google_name},
        expire_minutes=_OAUTH_PENDING_TTL_MINUTES,
        token_type=_OAUTH_PENDING_TOKEN_TYPE,
    )

    redirect = RedirectResponse(url=f"{settings.FRONTEND_URL}/auth/complete-registration", status_code=302)
    is_production = settings.ENVIRONMENT.lower() == "production"
    redirect.set_cookie(
        key=_OAUTH_PENDING_COOKIE,
        value=pending_token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=_OAUTH_PENDING_TTL_MINUTES * 60,
        path=_OAUTH_PENDING_COOKIE_PATH,
    )
    return redirect


@router.get("/oauth/pending", response_model=OAuthPendingInfoResponse)
async def oauth_pending_info(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> OAuthPendingInfoResponse:
    """
    Called by the frontend's "finish your signup" page on load, to fetch
    the identity Google already confirmed (email, suggested username,
    name) without having created a user row yet.
    """
    token = request.cookies.get(_OAUTH_PENDING_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No pending signup found. Please try Google sign-in again.")

    payload = decode_typed_token(token, _OAUTH_PENDING_TOKEN_TYPE)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Signup session expired. Please try Google sign-in again.")

    suggested_username = await _suggest_username(payload.get("name") or payload["email"].split("@")[0], db)

    return OAuthPendingInfoResponse(
        provider=payload["provider"],
        email=payload["email"],
        suggested_username=suggested_username,
        display_name=payload.get("name"),
    )


@router.post("/oauth/complete", response_model=UserPublicResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_REGISTER)
async def oauth_complete_registration(
    request: Request,
    payload: OAuthCompleteRegistrationRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserPublicResponse:
    """
    The user reviewed/edited their suggested username and submitted the
    finish-signup form. THIS is where the users row actually gets created —
    never in the OAuth callback. We re-derive their Google identity from the
    signed pending cookie (never trust the frontend for email/provider_id;
    the cookie is the only source of truth for those).
    """
    token = request.cookies.get(_OAUTH_PENDING_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No pending signup found. Please try Google sign-in again.")

    pending = decode_typed_token(token, _OAUTH_PENDING_TOKEN_TYPE)
    if not pending:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Signup session expired. Please try Google sign-in again.")

    provider = pending["provider"]
    provider_id = pending["provider_id"]
    email = pending["email"]

    # Race-condition guard: someone else may have registered this email or
    # username (or completed this exact pending signup twice) in the gap
    # between the callback and this submit.
    existing = await db.execute(
        select(User).where(
            or_(
                User.username == payload.username,
                (User.oauth_provider == provider) & (User.oauth_provider_id == provider_id),
                User.email == email,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken, or this account was already registered")

    user = User(
        email=email,
        username=payload.username,
        hashed_password=None,          # OAuth-only account — no password
        display_name=payload.display_name or pending.get("name") or None,
        oauth_provider=provider,
        oauth_provider_id=provider_id,
        role="user",
    )
    db.add(user)
    await db.flush()

    db.add(UserCredits(
        user_id=user.id,
        credits_remaining=settings.FREE_DAILY_CREDITS,
        credits_lifetime_used=0,
    ))
    db.add(UserGameProfile(
        user_id=user.id,
        coins=50,
        gems=0,
    ))
    await db.commit()
    await db.refresh(user)

    access_token, refresh_token_raw = await _issue_login_session(user, db)
    _set_auth_cookies(response, access_token, refresh_token_raw)
    response.delete_cookie(_OAUTH_PENDING_COOKIE, path=_OAUTH_PENDING_COOKIE_PATH)

    logger.info("New OAuth user registered: %s via %s", email, provider)
    return UserPublicResponse.model_validate(user)


@router.post("/refresh")
@limiter.limit(settings.RATE_LIMIT_REFRESH)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Rotate refresh token. Issues new access + refresh token pair."""
    refresh_token_raw = request.cookies.get("refresh_token")
    if not refresh_token_raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    token_hash = hash_token(refresh_token_raw)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored_token = result.scalar_one_or_none()

    if not stored_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if stored_token.is_revoked:
        logger.warning(
            "Revoked refresh token reuse detected — invalidating family %s",
            stored_token.token_family,
        )
        await db.execute(
            delete(RefreshToken).where(
                RefreshToken.token_family == stored_token.token_family
            )
        )
        await db.commit()
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session compromised. Please log in again.",
        )

    if stored_token.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    user_result = await db.execute(select(User).where(User.id == stored_token.user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    stored_token.is_revoked = True
    user.last_seen_at = datetime.now(timezone.utc)

    new_access_token = create_access_token({"sub": str(user.id), "role": user.role})
    new_refresh_token_raw = create_refresh_token()

    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_token(new_refresh_token_raw),
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_family=stored_token.token_family,
    ))
    await db.commit()

    _set_auth_cookies(response, new_access_token, new_refresh_token_raw)
    return {"ok": True}


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Revoke current refresh token and clear auth cookies."""
    refresh_token_raw = request.cookies.get("refresh_token")
    if refresh_token_raw:
        token_hash = hash_token(refresh_token_raw)
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        stored_token = result.scalar_one_or_none()
        if stored_token and not stored_token.is_revoked:
            stored_token.is_revoked = True
            await db.commit()

    _clear_auth_cookies(response)
    return {"ok": True}


@router.post("/logout-all")
async def logout_all(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Revoke ALL refresh tokens for this user — logs out every device."""
    await db.execute(
        delete(RefreshToken).where(
            RefreshToken.user_id == current_user.id,
            RefreshToken.is_revoked.is_(False),
        )
    )
    await db.commit()
    _clear_auth_cookies(response)

    logger.info("All sessions revoked for user: %s", current_user.email)
    return {"ok": True}


@router.get("/me", response_model=UserPrivateResponse)
async def me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> UserPrivateResponse:
    tier = await get_effective_tier(current_user.id, db)
    base = UserPrivateResponse.model_validate(current_user)
    return base.model_copy(update={"tier": tier})


@router.get("/legal/status", response_model=LegalConsentStatusResponse)
async def legal_status(current_user: User = Depends(get_current_user)) -> LegalConsentStatusResponse:
    required_version = settings.LEGAL_VERSION
    requires_reaccept = (
        not current_user.agreed_to_latest_legal
        or current_user.legal_version_accepted != required_version
    )
    return LegalConsentStatusResponse(
        required_legal_version=required_version,
        legal_version_accepted=current_user.legal_version_accepted,
        agreed_to_latest_legal=current_user.agreed_to_latest_legal,
        requires_reaccept=requires_reaccept,
    )


@router.post("/legal/accept", response_model=LegalConsentStatusResponse)
async def accept_legal_terms(
    payload: LegalConsentRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LegalConsentStatusResponse:
    required_version = settings.LEGAL_VERSION
    submitted_version = payload.legal_version or required_version
    if submitted_version != required_version:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Outdated legal version. Refresh and accept latest policies.",
        )

    consent = UserConsent(
        user_id=current_user.id,
        terms_version=required_version,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(consent)

    current_user.agreed_to_latest_legal = True
    current_user.legal_version_accepted = required_version

    await db.commit()

    return LegalConsentStatusResponse(
        required_legal_version=required_version,
        legal_version_accepted=current_user.legal_version_accepted,
        agreed_to_latest_legal=current_user.agreed_to_latest_legal,
        requires_reaccept=False,
    )


@router.get("/sessions")
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List all active sessions for the current user."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == current_user.id,
            RefreshToken.is_revoked.is_(False),
            RefreshToken.expires_at > now,
        )
    )
    tokens = result.scalars().all()
    return {
        "active_sessions": len(tokens),
        "sessions": [
            {
                "id": str(t.id),
                "created_at": t.created_at.isoformat(),
                "expires_at": t.expires_at.isoformat(),
            }
            for t in tokens
        ],
    }


@router.get("/settings", response_model=UserSettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsResponse:
    """Fetch the current user's player preferences (auto-play, volume, etc.), backfilling defaults for missing keys."""
    settings_dict = await get_or_create_settings(current_user.id, db)
    return UserSettingsResponse.model_validate(settings_dict)


@router.patch("/settings", response_model=UserSettingsResponse)
async def patch_settings(
    payload: UserSettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsResponse:
    """Partially update the current user's player preferences. Only sent fields are changed."""
    updated = await update_settings(
        current_user.id,
        payload.model_dump(exclude_unset=True),
        db,
    )
    return UserSettingsResponse.model_validate(updated)
