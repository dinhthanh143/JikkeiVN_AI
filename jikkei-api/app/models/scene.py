# SQLAlchemy models for scene engine authoring entities.
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import ARRAY, JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy import text as sa_text
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    game_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="normal", server_default=sa_text("'normal'"))
    starting_background_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("backgrounds.id", ondelete="SET NULL"), nullable=True)
    tier: Mapped[str] = mapped_column(String(20), nullable=False, default="free", server_default=sa_text("'free'"))
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sa_text("false"))
    is_nsfw: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sa_text("false"))
    scene_cover: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Denormalized counter — bumped on each genuinely new session (not resumes).
    play_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=sa_text("0"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(), default=lambda: datetime.now(timezone.utc))


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    scene_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    voice_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=sa_text("0"))
    initial_dialogue: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))


class CharacterExpression(Base):
    __tablename__ = "character_expressions"
    __table_args__ = (UniqueConstraint("character_id", "slot_key", name="uq_character_expressions_character_slot"),)

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    character_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    slot_key: Mapped[str] = mapped_column(String(50), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=sa_text("0"))


class CharacterAttribute(Base):
    __tablename__ = "character_attributes"
    __table_args__ = (UniqueConstraint("character_id", "attr_key", name="uq_character_attributes_character_attr"),)

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    character_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    attr_key: Mapped[str] = mapped_column(String(50), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    initial_value: Mapped[int] = mapped_column(Integer, nullable=False, default=50, server_default=sa_text("50"))
    min_value: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=sa_text("0"))
    max_value: Mapped[int] = mapped_column(Integer, nullable=False, default=100, server_default=sa_text("100"))
    is_visible_to_player: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=sa_text("true"))
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=sa_text("0"))


class Background(Base):
    __tablename__ = "backgrounds"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    scene_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False)
    # NULL  → template background (belongs to the authored scene)
    # non-NULL → per-session snapshot or personalized background; deleted
    #            automatically when the session is deleted (ON DELETE CASCADE)
    session_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("scene_sessions.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    image_url: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))


class PublicBackground(Base):
    """Curated, reusable background images any creator can pick from — not scene-scoped."""
    __tablename__ = "public_backgrounds"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String).with_variant(JSON(), "sqlite"), nullable=False, default=list, server_default=sa_text("'{}'"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=sa_text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))


class LoreChunk(Base):
    """
    Polymorphic lore store — exactly one of the four FK columns is set:
      scene_id              → template world lore
      character_id          → template character lore (personality, backstory)
      session_id            → AI-generated general session memory
      session_character_id  → AI-generated per-character session memory
    """
    __tablename__ = "lore_chunks"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    scene_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("scenes.id", ondelete="CASCADE"), nullable=True)
    character_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), nullable=True)
    session_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("scene_sessions.id", ondelete="CASCADE"), nullable=True)
    session_character_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("session_characters.id", ondelete="CASCADE"), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_type: Mapped[str] = mapped_column(String(20), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default=sa_text("1"))
    embedding: Mapped[Optional[list[float]]] = mapped_column(Vector(768).with_variant(JSON(), "sqlite"), nullable=True)
    turn_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ts_content: Mapped[Optional[str]] = mapped_column(TSVECTOR().with_variant(Text(), "sqlite"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))


class UserCredits(Base):
    __tablename__ = "user_credits"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    credits_remaining: Mapped[int] = mapped_column(Integer, nullable=False, default=20, server_default=sa_text("20"))
    credits_lifetime_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=sa_text("0"))
    # TASK-011: rolling-window model. NULL = no window active yet (fresh
    # account, or a window that has never been started). A timestamp means
    # "the current CREDIT_WINDOW_HOURS window began here" — replenish logic
    # in credit_service.py resets both this and credits_remaining once
    # `now >= window_started_at + CREDIT_WINDOW_HOURS`.
    window_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))


class SceneSession(Base):
    __tablename__ = "scene_sessions"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    scene_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    game_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="normal", server_default=sa_text("'normal'"))
    # Frozen scene inputs keep an active session isolated from later author edits.
    scene_description_snapshot: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scene_is_nsfw_snapshot: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    stable_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Short-lived cross-worker claim for one in-flight AI turn per session.
    turn_claim_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    turn_claimed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    turn_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=sa_text("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=sa_text("true"))
    is_resumable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=sa_text("true"))
    current_background_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("backgrounds.id", ondelete="SET NULL"), nullable=True)
    world_events: Mapped[list[str]] = mapped_column(ARRAY(String).with_variant(JSON(), "sqlite"), nullable=False, default=list, server_default=sa_text("'{}'"))
    history_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active_context_change: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    context_change_turns_remaining: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=sa_text("0"))
    outcome: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    outcome_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(), default=lambda: datetime.now(timezone.utc))
    current_choices: Mapped[list[str]] = mapped_column(ARRAY(String).with_variant(JSON(), "sqlite"), nullable=False, default=list, server_default=sa_text("'{}'"))


class SessionCharacter(Base):
    __tablename__ = "session_characters"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scene_sessions.id", ondelete="CASCADE"), nullable=False)
    source_character_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("characters.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    voice_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    initial_dialogue: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=sa_text("true"))
    is_session_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sa_text("false"))
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active", server_default=sa_text("'active'"))
    current_expression_key: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    attribute_values: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict, server_default=sa_text("'{}'"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(), default=lambda: datetime.now(timezone.utc))


class SessionCharacterExpression(Base):
    """
    Per-session expression snapshot. Template expressions are cloned here at
    session start, and personalized characters write here directly. Runtime
    prompts therefore never depend on mutable template expression rows.
    """
    __tablename__ = "session_character_expressions"
    __table_args__ = (UniqueConstraint("session_character_id", "slot_key", name="uq_session_character_expressions_char_slot"),)

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_character_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("session_characters.id", ondelete="CASCADE"), nullable=False)
    slot_key: Mapped[str] = mapped_column(String(50), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=sa_text("0"))


class DialogueTurn(Base):
    __tablename__ = "dialogue_turns"
    __table_args__ = (UniqueConstraint("session_id", "turn_number", name="uq_dialogue_turns_session_turn"),)

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scene_sessions.id", ondelete="CASCADE"), nullable=False)
    turn_number: Mapped[int] = mapped_column(Integer, nullable=False)
    input_type: Mapped[str] = mapped_column(String(20), nullable=False)
    player_input: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    context_change_text: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    attribute_delta: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict, server_default=sa_text("'{}'"))
    background_changed_to: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("backgrounds.id", ondelete="SET NULL"), nullable=True)
    scene_event: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    options_presented: Mapped[list[str]] = mapped_column(ARRAY(String).with_variant(JSON(), "sqlite"), nullable=False, default=list, server_default=sa_text("'{}'"))
    # Complete pre-turn runtime snapshot used by Redo. Keeping this on the
    # turn makes rollback atomic with the response it can replace.
    state_before: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))


class TurnMessage(Base):
    __tablename__ = "turn_messages"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    turn_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("dialogue_turns.id", ondelete="CASCADE"), nullable=False)
    session_character_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("session_characters.id", ondelete="CASCADE"), nullable=True)
    speaker_type: Mapped[str] = mapped_column(String(20), nullable=False, default="character", server_default=sa_text("'character'"))
    messages: Mapped[list[str]] = mapped_column(ARRAY(String).with_variant(JSON(), "sqlite"), nullable=False, default=list, server_default=sa_text("'{}'"))
    expression_key: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    speaker_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=sa_text("0"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))


class SceneStartChoice(Base):
    __tablename__ = "scene_start_choices"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    scene_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False)
    choice_text: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=sa_text("0"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), default=lambda: datetime.now(timezone.utc))
