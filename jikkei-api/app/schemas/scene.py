# Pydantic request and response schemas for scene engine endpoints.
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SceneSchemaBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Request Schemas ─────────────────────────────────────────────────────────

class SceneCreateRequest(SceneSchemaBase):
    title: str = Field(min_length=1, max_length=80)
    description: str | None = None
    game_mode: Literal['normal', 'survival'] = 'normal'
    is_nsfw: bool = False
    tier: Literal['free', 'premium'] = 'free'
    is_public: bool = False
    # Optional — when omitted/None, the existing scene_cover value is left
    # untouched (partial-update semantics). Client-side auto-generation
    # (TASK-008) sends this whenever cover compositing succeeds; on failure
    # the client simply omits the field so the prior cover survives.
    scene_cover: str | None = None


class SceneUpdateRequest(SceneSchemaBase):
    """Partial scene update; omitted fields retain their current values."""

    title: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = None
    game_mode: Literal['normal', 'survival'] | None = None
    is_nsfw: bool | None = None
    tier: Literal['free', 'premium'] | None = None
    is_public: bool | None = None
    scene_cover: str | None = None


class CharacterCreateRequest(SceneSchemaBase):
    name: str = Field(min_length=1, max_length=60)
    description: str = Field(min_length=1, max_length=800)
    avatar_url: str | None = None
    position: int = 0
    initial_dialogue: str | None = Field(default=None, max_length=400)


class ExpressionUpdateItem(SceneSchemaBase):
    slot_key: str = Field(min_length=1, max_length=50)
    display_name: str = Field(min_length=1, max_length=100)
    image_url: str | None = None


class ExpressionBulkUpdateRequest(SceneSchemaBase):
    expressions: list[ExpressionUpdateItem]


class AttributeUpdateItem(SceneSchemaBase):
    attr_key: str = Field(min_length=1, max_length=50)
    initial_value: int
    is_visible_to_player: bool = True


class AttributeUpdateRequest(SceneSchemaBase):
    attributes: list[AttributeUpdateItem]


class RulesBulkUpdateRequest(SceneSchemaBase):
    rules: list[str] = Field(min_length=0, max_length=5)


class TriggerCreateRequest(SceneSchemaBase):
    attr_key: str = Field(min_length=1, max_length=50)
    operator: Literal['lt', 'gt', 'lte', 'gte', 'eq']
    threshold: int
    behavior_instruction: str = Field(min_length=1, max_length=300)


class BackgroundCreateRequest(SceneSchemaBase):
    name: str = Field(min_length=1, max_length=80)
    image_url: str
    # Optional — when provided the background is session-owned (personalized edit).
    # NULL means it belongs to the scene template (all players see it).
    session_id: UUID | None = None


class SessionStartRequest(SceneSchemaBase):
    scene_id: UUID


class PlayerTurnRequest(SceneSchemaBase):
    session_id: UUID
    input_type: Literal['prompt', 'option', 'context_change', 'redo', 'system']
    player_input: str | None = None
    context_change_text: str | None = Field(default=None, max_length=200)


class CloudinarySignatureRequest(SceneSchemaBase):
    folder: str
    public_id: str | None = None


# ── Response Schemas ────────────────────────────────────────────────────────

class CloudinarySignatureResponse(SceneSchemaBase):
    signature: str
    timestamp: int
    api_key: str
    cloud_name: str
    folder: str
    eager: list[str] | None = None


class CloudinaryUploadResponse(SceneSchemaBase):
    url: str
    public_id: str
    folder: str
    bytes: int
    format: str | None = None
    width: int | None = None
    height: int | None = None


class ExpressionResponse(SceneSchemaBase):
    id: UUID
    character_id: UUID
    slot_key: str
    display_name: str
    image_url: str | None
    display_order: int


class AttributeResponse(SceneSchemaBase):
    id: UUID
    character_id: UUID
    attr_key: str
    display_name: str
    initial_value: int
    min_value: int
    max_value: int
    is_visible_to_player: bool
    display_order: int


class RuleResponse(SceneSchemaBase):
    id: UUID
    character_id: UUID
    rule_text: str
    priority: int


class TriggerResponse(SceneSchemaBase):
    id: UUID
    character_id: UUID
    attr_key: str
    operator: str
    threshold: int
    behavior_instruction: str
    is_active: bool


class CharacterResponse(SceneSchemaBase):
    id: UUID
    scene_id: UUID
    user_id: UUID
    name: str
    description: str
    avatar_url: str | None
    voice_id: str | None
    position: int
    initial_dialogue: str | None
    created_at: datetime
    expressions: list[ExpressionResponse] = Field(default_factory=list)
    attributes: list[AttributeResponse] = Field(default_factory=list)


class BackgroundResponse(SceneSchemaBase):
    id: UUID
    scene_id: UUID
    # NULL → template background; non-NULL → session-owned (personalized edit)
    session_id: UUID | None = None
    name: str
    image_url: str
    created_at: datetime


class PublicBackgroundResponse(SceneSchemaBase):
    id: UUID
    name: str
    image_url: str
    category: str | None
    tags: list[str]
    created_at: datetime


class SceneResponse(SceneSchemaBase):
    id: UUID
    user_id: UUID
    title: str
    description: str | None
    game_mode: str
    tier: str
    starting_background_id: UUID | None
    is_public: bool
    is_nsfw: bool
    play_count: int = 0
    created_at: datetime
    updated_at: datetime
    scene_cover: str | None = None
    characters: list[CharacterResponse] = Field(default_factory=list)
    backgrounds: list[BackgroundResponse] = Field(default_factory=list)
    author: str | None = None


class CreditsResponse(SceneSchemaBase):
    credits_remaining: int
    credits_lifetime_used: int
    # TASK-011: rolling-window model. window_started_at is None if the user
    # has never used a credit yet. resets_at is computed server-side
    # (window_started_at + CREDIT_WINDOW_HOURS) so the frontend never has to
    # duplicate that math or know the window length itself. session_cap is
    # the caller's current tier cap (SESSION_CREDITS_FREE/PREMIUM) — lets
    # the frontend render "14/80" without a second tier lookup.
    window_started_at: datetime | None = None
    resets_at: datetime | None = None
    session_cap: int


# ── Lore chunks ──────────────────────────────────────────────────────────────

class LoreChunkCreateRequest(SceneSchemaBase):
    content: str = Field(min_length=1, max_length=2000)
    chunk_type: Literal['world', 'rule', 'character', 'event'] = 'world'
    priority: int = Field(default=2, ge=1, le=4)


class LoreChunkResponse(SceneSchemaBase):
    id: UUID
    scene_id: UUID | None
    character_id: UUID | None
    content: str
    chunk_type: str
    priority: int
    created_at: datetime


# ── Scene start choices ───────────────────────────────────────────────────────

class SceneStartChoiceCreateRequest(SceneSchemaBase):
    choice_text: str = Field(min_length=1, max_length=300)
    display_order: int = Field(default=0, ge=0)


class SceneStartChoiceResponse(SceneSchemaBase):
    id: UUID
    scene_id: UUID
    choice_text: str
    display_order: int
    created_at: datetime


# ── Turn / Dialogue (defined before SessionResponse — referenced inside it) ──

class TurnMessageResponse(SceneSchemaBase):
    id: UUID
    turn_id: UUID
    session_character_id: UUID | None
    speaker_type: str = "character"
    messages: list[str]
    expression_key: str | None
    speaker_order: int
    created_at: datetime
    # The character's status/is_active AFTER this turn's change, ONLY when the
    # AI's response actually changed it this turn (TASK-009). None means
    # "unchanged this turn" — lets the frontend tell that apart from an
    # explicit no-op, which is what makes dialogue-synced disappearance
    # possible (see useGameStore.pendingCharChanges).
    resulting_status: str | None = None
    resulting_is_active: bool | None = None


# ── Session Character (live runtime copy) ───────────────────────────────────

class SessionCharacterExpressionResponse(SceneSchemaBase):
    id: UUID
    session_character_id: UUID
    slot_key: str
    display_name: str
    image_url: str | None
    display_order: int


class SessionCharacterCreateRequest(SceneSchemaBase):
    name: str = Field(min_length=1, max_length=60)
    description: str = Field(min_length=1, max_length=800)
    avatar_url: str | None = None
    position: int = 0
    initial_dialogue: str | None = Field(default=None, max_length=400)


class SessionCharacterUpdateRequest(SceneSchemaBase):
    name: str = Field(min_length=1, max_length=60)
    description: str = Field(min_length=1, max_length=800)
    avatar_url: str | None = None
    position: int = 0
    initial_dialogue: str | None = Field(default=None, max_length=400)


class SessionCharacterExpressionUpdateItem(SceneSchemaBase):
    slot_key: str = Field(min_length=1, max_length=50)
    display_name: str = Field(min_length=1, max_length=100)
    image_url: str | None = None


class SessionCharacterExpressionBulkUpdateRequest(SceneSchemaBase):
    expressions: list[SessionCharacterExpressionUpdateItem]


class SessionCharacterAttributeItem(SceneSchemaBase):
    attr_key: str = Field(min_length=1, max_length=50)
    initial_value: int


class SessionCharacterAttributeUpdateRequest(SceneSchemaBase):
    attributes: list[SessionCharacterAttributeItem]


class SessionCharacterResponse(SceneSchemaBase):
    id: UUID
    session_id: UUID
    source_character_id: UUID | None
    name: str
    description: str | None
    avatar_url: str | None
    voice_id: str | None
    position: int | None
    initial_dialogue: str | None
    is_active: bool
    is_session_only: bool
    status: str
    current_expression_key: str | None
    attribute_values: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    expressions: list[SessionCharacterExpressionResponse] = Field(default_factory=list)


# ── Session ─────────────────────────────────────────────────────────────────

class SessionResponse(SceneSchemaBase):
    id: UUID
    scene_id: UUID
    user_id: UUID
    game_mode: str
    turn_count: int
    is_active: bool
    is_resumable: bool
    current_background_id: UUID | None
    world_events: list[str]
    history_summary: str | None
    active_context_change: str | None
    context_change_turns_remaining: int
    outcome: str | None
    outcome_message: str | None
    started_at: datetime
    ended_at: datetime | None
    created_at: datetime
    updated_at: datetime
    current_background: BackgroundResponse | None = None
    session_characters: list[SessionCharacterResponse] = Field(default_factory=list)
    # Choices to show in ChoicePanel on load (start choices on new game, last AI choices on resume)
    current_choices: list[str] = Field(default_factory=list)
    # Initial dialogues from turn 0 — replayed on both new game and resume
    turn_zero_messages: list[TurnMessageResponse] = Field(default_factory=list)
    # Messages from the most recently played turn — what should actually be on
    # screen on resume/reload if turn_count > 0. turn_zero_messages stays the
    # "opening" reference; this is the "where you left off" reference.
    latest_turn_messages: list[TurnMessageResponse] = Field(default_factory=list)


# ── Turn response ────────────────────────────────────────────────────────────

class SessionStateSnapshot(SceneSchemaBase):
    """Minimal session state returned alongside every TurnResponse."""
    turn_count: int
    is_active: bool
    world_events: list[str]
    history_summary: str | None
    active_context_change: str | None
    context_change_turns_remaining: int
    outcome: str | None
    outcome_message: str | None
    current_background_id: UUID | None
    current_background: BackgroundResponse | None


class TurnResponse(SceneSchemaBase):
    id: UUID
    session_id: UUID
    turn_number: int
    input_type: str
    player_input: str | None
    context_change_text: str | None
    attribute_delta: dict[str, Any]
    background_changed_to: UUID | None
    scene_event: str | None
    options_presented: list[str]
    tokens_used: int | None
    created_at: datetime
    # Full AI response — no secondary fetch needed
    turn_messages: list[TurnMessageResponse] = Field(default_factory=list)
    session_state: SessionStateSnapshot | None = None
    session_characters: list[SessionCharacterResponse] = Field(default_factory=list)
