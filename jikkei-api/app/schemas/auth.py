# Pydantic request and response schemas for authentication endpoints — production hardened.
import re
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class LoginRequest(BaseModel):
    email: EmailStr | None = None
    username: str | None = None
    password: str = Field(min_length=8)

    @field_validator("username")
    @classmethod
    def username_format(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if not re.match(r"^[a-zA-Z0-9_-]{3,20}$", value):
            raise ValueError("Username must be 3-20 chars: letters, numbers, underscore, or dash only")
        return value

    @model_validator(mode="after")
    def require_identifier(self) -> "LoginRequest":
        if self.email is None and self.username is None:
            raise ValueError("Either email or username is required")
        return self


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=20)
    password: str = Field(min_length=8)
    display_name: str | None = Field(default=None, max_length=100)
    date_of_birth: date | None = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password too long (max 128 characters)")
        if v.isalpha():
            raise ValueError("Password must contain at least one number or symbol")
        return v

    @field_validator("username")
    @classmethod
    def username_format(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_-]{3,20}$", v):
            raise ValueError("Username must be 3-20 chars: letters, numbers, underscore, or dash only")
        return v

    @field_validator("date_of_birth")
    @classmethod
    def dob_must_be_in_past_and_reasonable(cls, v: date | None) -> date | None:
        if v is None:
            return v
        today = date.today()
        if v >= today:
            raise ValueError("Date of birth must be in the past")
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        if age > 120:
            raise ValueError("Date of birth is not plausible")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OAuthPendingInfoResponse(BaseModel):
    """Returned to the frontend so it can prefill the 'finish registration' form."""
    provider: str
    email: str
    suggested_username: str
    display_name: str | None


class OAuthCompleteRegistrationRequest(BaseModel):
    """Submitted by the user after reviewing/editing the suggested username."""
    username: str = Field(min_length=3, max_length=20)
    display_name: str | None = Field(default=None, max_length=100)

    @field_validator("username")
    @classmethod
    def username_format(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_-]{3,20}$", v):
            raise ValueError("Username must be 3-20 chars: letters, numbers, underscore, or dash only")
        return v


class UserPublicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    username: str
    display_name: str | None
    role: str
    avatar_url: str | None
    created_at: datetime
    is_active: bool


class UserPrivateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    username: str
    display_name: str | None
    role: str
    avatar_url: str | None
    created_at: datetime
    is_active: bool
    tier: str = "free"
    agreed_to_latest_legal: bool
    legal_version_accepted: str | None


class UserAdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    username: str
    display_name: str | None
    role: str
    avatar_url: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None
    last_seen_at: datetime | None


class LegalConsentRequest(BaseModel):
    legal_version: str | None = None


class LegalConsentStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    required_legal_version: str
    legal_version_accepted: str | None
    agreed_to_latest_legal: bool
    requires_reaccept: bool


class UserSettingsResponse(BaseModel):
    """Player preferences — stored as a single jsonb blob on users.settings.
    model_validate() is called on the raw dict from the DB, not an ORM instance,
    so from_attributes=False is correct here."""

    sfx_volume: int
    bgm_volume: int
    sfx_enabled: bool
    bgm_enabled: bool
    auto_play: bool
    language: str
    text_sfx_enabled: bool = True
    text_sfx_volume: int = Field(default=60, ge=0, le=100)
    text_sfx_type: int = Field(default=1, ge=1, le=3)


class UserSettingsUpdateRequest(BaseModel):
    """All fields optional — PATCH semantics."""
    sfx_volume: int | None = Field(default=None, ge=0, le=100)
    bgm_volume: int | None = Field(default=None, ge=0, le=100)
    sfx_enabled: bool | None = None
    bgm_enabled: bool | None = None
    auto_play: bool | None = None
    language: str | None = Field(default=None, min_length=2, max_length=10)
    text_sfx_enabled: bool | None = None
    text_sfx_volume: int | None = Field(default=None, ge=0, le=100)
    text_sfx_type: int | None = Field(default=None, ge=1, le=3)


class PublicUserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    display_name: str | None
    avatar_url: str | None
    profile_banner: str | None
    bio: str | None
    # Age derived from date_of_birth — never expose raw DOB publicly
    age: int | None
    # Join year only (not full timestamp) for privacy
    joined_year: int
    # Tier badge — derive from user_subscriptions; "free" if no row
    tier: str
    # Public story count — derive from Scene query
    public_story_count: int
    # Total plays across all their public stories
    total_plays: int


UserResponse = UserPrivateResponse
