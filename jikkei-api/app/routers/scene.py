from datetime import datetime, timezone
from uuid import UUID
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.dependencies import assert_resource_owner, get_current_user
from app.main import limiter
from app.models.scene import (
    Background,
    Character,
    CharacterAttribute,
    CharacterExpression,
    DialogueTurn,
    LoreChunk,
    PublicBackground,
    Scene,
    SceneSession,
    SceneStartChoice,
    SessionCharacter,
    SessionCharacterExpression,
    TurnMessage,
)
from app.models.user import User
from app.schemas.scene import (
    AttributeResponse,
    AttributeUpdateRequest,
    BackgroundCreateRequest,
    BackgroundResponse,
    CharacterCreateRequest,
    CharacterResponse,
    ExpressionBulkUpdateRequest,
    ExpressionResponse,
    LoreChunkCreateRequest,
    LoreChunkResponse,
    PublicBackgroundResponse,
    SceneCreateRequest,
    SceneUpdateRequest,
    SceneResponse,
    SceneStartChoiceCreateRequest,
    SceneStartChoiceResponse,
    SessionCharacterAttributeUpdateRequest,
    SessionCharacterCreateRequest,
    SessionCharacterExpressionBulkUpdateRequest,
    SessionCharacterExpressionResponse,
    SessionCharacterResponse,
    SessionCharacterUpdateRequest,
    SessionResponse,
    SessionStartRequest,
    SessionStateSnapshot,
    PlayerTurnRequest,
    TurnMessageResponse,
    TurnResponse,
)
from app.services.ai_service import apply_turn_result, run_ai_turn
from app.services.context_builder import build_stable_prompt_for_session, build_turn_context
from app.services.credit_service import consume_credit
from app.services.lore_service import (
    activate_context_change,
    delete_session_character_chunks,
    embed_scene_setup,
    embed_session_character_setup,
    snapshot_lore_to_session,
)
from app.services.turn_claim import assert_session_turn_claim, claim_session_turn, release_session_turn
from app.services.turn_snapshot import restore_turn_state
from app.services.subscription_service import get_effective_tier
from app.services.cloudinary_service import delete_story_assets
from app.core.turn_timing import TurnTimer

router = APIRouter(tags=["scenes"])

logger = logging.getLogger(__name__)


# ── Tier limit constants ─────────────────────────────────────────
TIER_LIMITS = {
    "free":    {"characters": 2, "backgrounds": 2, "max_stories": 5},
    "premium": {"characters": 3, "backgrounds": 5, "max_stories": 20},
}


class StartingBackgroundRequest(BaseModel):
    background_id: UUID


# ── Background tasks ──────────────────────────────────────────────────────────

# ── Auth helpers ──────────────────────────────────────────────────────────────

async def _get_owned_scene(scene_id: UUID, current_user: User, db: AsyncSession) -> Scene:
    result = await db.execute(select(Scene).where(Scene.id == scene_id))
    scene = result.scalar_one_or_none()
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")

    await assert_resource_owner(scene.user_id, current_user)
    return scene


async def _get_scene_character(scene_id: UUID, character_id: UUID, current_user: User, db: AsyncSession) -> Character:
    await _get_owned_scene(scene_id, current_user, db)
    result = await db.execute(select(Character).where(Character.id == character_id, Character.scene_id == scene_id))
    character = result.scalar_one_or_none()
    if character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    return character


async def _get_scene_background(scene_id: UUID, background_id: UUID, current_user: User, db: AsyncSession) -> Background:
    await _get_owned_scene(scene_id, current_user, db)
    # session_id.is_(None) explicitly required: this is the AUTHOR-facing,
    # template-only lookup. Without this filter, an author's delete/update
    # could resolve to a PLAYER's session-owned background row (same
    # scene_id, different session_id) since background ids are globally
    # unique — nothing else here distinguished template rows from session
    # clones until this fix. Session-owned backgrounds have their own
    # dedicated route (delete_session_background) with the "never zero" /
    # "fallback if active" invariants that this author-facing path doesn't
    # need or enforce.
    result = await db.execute(select(Background).where(Background.id == background_id, Background.scene_id == scene_id, Background.session_id.is_(None)))
    background = result.scalar_one_or_none()
    if background is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Background not found")
    return background


async def _get_owned_session(
    session_id: UUID, current_user: User, db: AsyncSession, *, require_active: bool = False
) -> SceneSession:
    result = await db.execute(select(SceneSession).where(SceneSession.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    await assert_resource_owner(session.user_id, current_user)
    if require_active and not session.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is not active")
    return session


async def _get_owned_session_character(
    session_id: UUID, session_character_id: UUID, current_user: User, db: AsyncSession,
) -> SessionCharacter:
    """
    Epic H auth helper, mirrors _get_scene_character's shape for the
    session-character equivalent. Used by all of update/delete/attributes/
    expressions for SessionCharacter — ownership is checked via the parent
    session, not directly on SessionCharacter (which has no user_id column
    of its own).
    """
    await _get_owned_session(session_id, current_user, db)
    result = await db.execute(
        select(SessionCharacter).where(
            SessionCharacter.id == session_character_id,
            SessionCharacter.session_id == session_id,
        )
    )
    session_character = result.scalar_one_or_none()
    if session_character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session character not found")
    return session_character


async def _invalidate_stable_prompt(session_id: UUID, db: AsyncSession) -> None:
    await db.execute(
        update(SceneSession)
        .where(SceneSession.id == session_id)
        .values(stable_prompt=None)
        .execution_options(synchronize_session=False)
    )


# ── Tier limit guards ─────────────────────────────────────────────────────────

async def check_scene_character_limit(scene_id: UUID, current_user: User, db: AsyncSession) -> None:
    scene = await _get_owned_scene(scene_id, current_user, db)
    limit = TIER_LIMITS[scene.tier]["characters"]
    count = int(await db.scalar(select(func.count()).select_from(Character).where(Character.scene_id == scene_id)) or 0)
    if count >= limit:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"{scene.tier.capitalize()}-tier stories are limited to {limit} characters")


async def check_scene_background_limit(scene_id: UUID, current_user: User, db: AsyncSession) -> None:
    scene = await _get_owned_scene(scene_id, current_user, db)
    limit = TIER_LIMITS[scene.tier]["backgrounds"]
    # Only count template backgrounds (session_id IS NULL) against the limit.
    # Session-owned backgrounds are per-player and don't count toward the scene author's quota.
    count = int(
        await db.scalar(
            select(func.count()).select_from(Background).where(
                Background.scene_id == scene_id,
                Background.session_id.is_(None),
            )
        ) or 0
    )
    if count >= limit:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"{scene.tier.capitalize()}-tier stories are limited to {limit} backgrounds")


async def check_session_character_limit(session_id: UUID, current_user: User, db: AsyncSession) -> None:
    """
    Epic H1: caps how many SESSION-ONLY (personalized, is_session_only=True)
    characters a session may have, gated by the current user's effective
    subscription tier — not the scene's tier (TIER_LIMITS above governs the
    scene AUTHOR's Original-mode character count; this is a completely
    separate cap on what a PLAYER can add to their own session in
    Personalized mode).

    Counts only is_session_only=True characters. Template-derived
    SessionCharacter rows (cloned at session start, is_session_only=False)
    never count against this — they aren't something the player "added".
    """
    user_tier = await get_effective_tier(current_user.id, db)
    limit = settings.MAX_SESSION_CHARACTERS_PREMIUM if user_tier == "premium" else settings.MAX_SESSION_CHARACTERS_FREE
    count = int(
        await db.scalar(
            select(func.count()).select_from(SessionCharacter).where(
                SessionCharacter.session_id == session_id,
                SessionCharacter.is_session_only == True,
            )
        ) or 0
    )
    if count >= limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{user_tier.capitalize()} accounts can add at most {limit} personalized characters per session",
        )


async def _check_scene_character_limit_dependency(
    scene_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
) -> None:
    await check_scene_character_limit(scene_id, current_user, db)


async def _check_scene_background_limit_dependency(
    scene_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
) -> None:
    await check_scene_background_limit(scene_id, current_user, db)


async def _check_session_character_limit_dependency(
    session_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
) -> None:
    await check_session_character_limit(session_id, current_user, db)


# ── Response builders ─────────────────────────────────────────────────────────

def _build_character_response(
    character: Character, expressions: list[CharacterExpression], attributes: list[CharacterAttribute],
) -> CharacterResponse:
    base = CharacterResponse.model_validate(character)
    return base.model_copy(update={
        "expressions": [ExpressionResponse.model_validate(e) for e in expressions],
        "attributes": [AttributeResponse.model_validate(a) for a in attributes],
    })


async def _build_single_character_response(character: Character, db: AsyncSession) -> CharacterResponse:
    expr_result = await db.execute(
        select(CharacterExpression).where(CharacterExpression.character_id == character.id)
        .order_by(CharacterExpression.display_order, CharacterExpression.slot_key)
    )
    attr_result = await db.execute(
        select(CharacterAttribute).where(CharacterAttribute.character_id == character.id)
        .order_by(CharacterAttribute.display_order, CharacterAttribute.attr_key)
    )
    return _build_character_response(character, list(expr_result.scalars().all()), list(attr_result.scalars().all()))


def _build_session_character_response(
    session_character: SessionCharacter, expressions: list[SessionCharacterExpression],
) -> SessionCharacterResponse:
    base = SessionCharacterResponse.model_validate(session_character)
    return base.model_copy(update={
        "expressions": [SessionCharacterExpressionResponse.model_validate(e) for e in expressions],
    })


async def _build_single_session_character_response(session_character: SessionCharacter, db: AsyncSession) -> SessionCharacterResponse:
    expr_result = await db.execute(
        select(SessionCharacterExpression).where(SessionCharacterExpression.session_character_id == session_character.id)
        .order_by(SessionCharacterExpression.display_order, SessionCharacterExpression.slot_key)
    )
    return _build_session_character_response(session_character, list(expr_result.scalars().all()))


async def _build_scene_response(scene: Scene, db: AsyncSession) -> SceneResponse:
    # Only return template backgrounds (session_id IS NULL) in the scene response —
    # session-owned backgrounds are player-private and only visible in their session.
    bgs = list((await db.execute(
        select(Background)
        .where(Background.scene_id == scene.id, Background.session_id.is_(None))
        .order_by(Background.id)
    )).scalars().all())
    chars = list((await db.execute(select(Character).where(Character.scene_id == scene.id).order_by(Character.position, Character.created_at))).scalars().all())
    char_ids = [c.id for c in chars]

    exprs_by_char: dict[UUID, list] = {cid: [] for cid in char_ids}
    attrs_by_char: dict[UUID, list] = {cid: [] for cid in char_ids}

    if char_ids:
        for e in (await db.execute(select(CharacterExpression).where(CharacterExpression.character_id.in_(char_ids)).order_by(CharacterExpression.character_id, CharacterExpression.display_order))).scalars().all():
            exprs_by_char.setdefault(e.character_id, []).append(e)
        for a in (await db.execute(select(CharacterAttribute).where(CharacterAttribute.character_id.in_(char_ids)).order_by(CharacterAttribute.character_id, CharacterAttribute.display_order))).scalars().all():
            attrs_by_char.setdefault(a.character_id, []).append(a)

    author = (await db.execute(select(User.username).where(User.id == scene.user_id))).scalar_one_or_none()
    base = SceneResponse.model_validate(scene)
    return base.model_copy(update={
        "characters": [_build_character_response(c, exprs_by_char.get(c.id, []), attrs_by_char.get(c.id, [])) for c in chars],
        "backgrounds": [BackgroundResponse.model_validate(b) for b in bgs],
        "author": author,
        "scene_cover": scene.scene_cover,
    })


async def _load_session_characters(session_id: UUID, db: AsyncSession) -> list[SessionCharacter]:
    result = await db.execute(
        select(SessionCharacter).where(SessionCharacter.session_id == session_id)
        .order_by(SessionCharacter.position, SessionCharacter.created_at)
    )
    return list(result.scalars().all())


async def _load_turn_zero(session_id: UUID, db: AsyncSession) -> tuple[DialogueTurn | None, list[TurnMessage]]:
    turn = (await db.execute(select(DialogueTurn).where(DialogueTurn.session_id == session_id, DialogueTurn.turn_number == 0))).scalar_one_or_none()
    if turn is None:
        return None, []
    msgs = list((await db.execute(select(TurnMessage).where(TurnMessage.turn_id == turn.id).order_by(TurnMessage.speaker_order))).scalars().all())
    return turn, msgs


async def _load_latest_turn(session_id: UUID, db: AsyncSession) -> tuple[DialogueTurn | None, list[TurnMessage]]:
    turn = (await db.execute(
        select(DialogueTurn)
        .where(DialogueTurn.session_id == session_id, DialogueTurn.turn_number > 0)
        .order_by(DialogueTurn.turn_number.desc())
        .limit(1)
    )).scalar_one_or_none()
    if turn is None:
        return None, []
    msgs = list((await db.execute(select(TurnMessage).where(TurnMessage.turn_id == turn.id).order_by(TurnMessage.speaker_order))).scalars().all())
    return turn, msgs


async def _build_session_response(session: SceneSession, db: AsyncSession) -> SessionResponse:
    current_background = None
    if session.current_background_id:
        bg = (await db.execute(select(Background).where(Background.id == session.current_background_id))).scalar_one_or_none()
        if bg:
            current_background = BackgroundResponse.model_validate(bg)

    session_chars = await _load_session_characters(session.id, db)
    _, turn_zero_messages = await _load_turn_zero(session.id, db)
    _, latest_turn_messages = await _load_latest_turn(session.id, db)

    # Batch-load expressions for all session characters in one query, same
    # pattern as _build_scene_response's exprs_by_char — avoids N+1 queries
    # when a session has multiple personalized characters.
    sc_ids = [sc.id for sc in session_chars]
    exprs_by_sc: dict[UUID, list[SessionCharacterExpression]] = {sid: [] for sid in sc_ids}
    if sc_ids:
        for e in (await db.execute(
            select(SessionCharacterExpression)
            .where(SessionCharacterExpression.session_character_id.in_(sc_ids))
            .order_by(SessionCharacterExpression.session_character_id, SessionCharacterExpression.display_order)
        )).scalars().all():
            exprs_by_sc.setdefault(e.session_character_id, []).append(e)

    return SessionResponse(
        id=session.id, scene_id=session.scene_id, user_id=session.user_id,
        game_mode=session.game_mode, turn_count=session.turn_count,
        is_active=session.is_active, is_resumable=session.is_resumable,
        current_background_id=session.current_background_id,
        world_events=list(session.world_events or []),
        history_summary=session.history_summary,
        active_context_change=session.active_context_change,
        context_change_turns_remaining=session.context_change_turns_remaining,
        outcome=session.outcome, outcome_message=session.outcome_message,
        started_at=session.started_at, ended_at=session.ended_at,
        created_at=session.created_at, updated_at=session.updated_at,
        current_background=current_background,
        current_choices=list(session.current_choices or []),
        session_characters=[_build_session_character_response(sc, exprs_by_sc.get(sc.id, [])) for sc in session_chars],
        turn_zero_messages=[TurnMessageResponse.model_validate(tm) for tm in turn_zero_messages],
        latest_turn_messages=[TurnMessageResponse.model_validate(tm) for tm in latest_turn_messages],
    )


def _build_session_state_snapshot(session: SceneSession, bg: BackgroundResponse | None) -> SessionStateSnapshot:
    return SessionStateSnapshot(
        turn_count=session.turn_count, is_active=session.is_active,
        world_events=list(session.world_events or []), history_summary=session.history_summary,
        active_context_change=session.active_context_change,
        context_change_turns_remaining=session.context_change_turns_remaining,
        outcome=session.outcome, outcome_message=session.outcome_message,
        current_background_id=session.current_background_id, current_background=bg,
    )


async def _build_turn_response(turn: DialogueTurn, turn_messages: list[TurnMessage], session: SceneSession, db: AsyncSession) -> TurnResponse:
    bg = None
    if session.current_background_id:
        raw = (await db.execute(select(Background).where(Background.id == session.current_background_id))).scalar_one_or_none()
        if raw:
            bg = BackgroundResponse.model_validate(raw)
    session_chars = await _load_session_characters(session.id, db)
    sc_ids = [sc.id for sc in session_chars]
    expressions_by_character: dict[UUID, list[SessionCharacterExpression]] = {sc_id: [] for sc_id in sc_ids}
    if sc_ids:
        expressions = (await db.execute(
            select(SessionCharacterExpression)
            .where(SessionCharacterExpression.session_character_id.in_(sc_ids))
            .order_by(SessionCharacterExpression.session_character_id, SessionCharacterExpression.display_order)
        )).scalars().all()
        for expression in expressions:
            expressions_by_character.setdefault(expression.session_character_id, []).append(expression)

    return TurnResponse(
        id=turn.id, session_id=turn.session_id, turn_number=turn.turn_number,
        input_type=turn.input_type, player_input=turn.player_input,
        context_change_text=turn.context_change_text, attribute_delta=turn.attribute_delta or {},
        background_changed_to=turn.background_changed_to, scene_event=turn.scene_event,
        options_presented=list(turn.options_presented or []), tokens_used=turn.tokens_used,
        created_at=turn.created_at,
        turn_messages=[TurnMessageResponse.model_validate(tm) for tm in turn_messages],
        session_state=_build_session_state_snapshot(session, bg),
        session_characters=[
            _build_session_character_response(sc, expressions_by_character.get(sc.id, []))
            for sc in session_chars
        ],
    )


# ── Session-start helpers ─────────────────────────────────────────────────────

async def _build_initial_attribute_values(scene_id: UUID, db: AsyncSession) -> dict[str, dict[str, int]]:
    chars = list((await db.execute(select(Character).where(Character.scene_id == scene_id).order_by(Character.position, Character.created_at))).scalars().all())
    if not chars:
        return {}
    char_ids = [c.id for c in chars]
    attrs_by_char: dict[UUID, list[CharacterAttribute]] = {}
    for a in (await db.execute(select(CharacterAttribute).where(CharacterAttribute.character_id.in_(char_ids)).order_by(CharacterAttribute.character_id, CharacterAttribute.display_order))).scalars().all():
        attrs_by_char.setdefault(a.character_id, []).append(a)
    return {str(c.id): {a.attr_key: int(a.initial_value) for a in attrs_by_char.get(c.id, [])} for c in chars}


async def _create_session_characters(
    session: SceneSession, scene_id: UUID, initial_attribute_values: dict[str, dict[str, int]], db: AsyncSession,
) -> list[SessionCharacter]:
    chars = list((await db.execute(select(Character).where(Character.scene_id == scene_id).order_by(Character.position, Character.created_at))).scalars().all())
    if not chars:
        return []

    session_chars: list[SessionCharacter] = []
    for character in chars:
        sc = SessionCharacter(
            session_id=session.id,
            source_character_id=character.id,
            name=character.name,
            description=character.description,
            avatar_url=character.avatar_url,
            voice_id=character.voice_id,
            position=character.position,
            initial_dialogue=character.initial_dialogue,
            is_active=True,
            is_session_only=False,
            status="active",
            # "neutral" is a reserved slot key, always valid, that always
            # resolves to avatar_url in-game (see expressionImage() in
            # storyPresentation.ts) — never sourced from character_expressions'
            # is_default flag, which was purely positional (first-added-wins,
            # see replace_character_expressions) and not a real semantic
            # "neutral face" designation.
            current_expression_key="neutral",
            attribute_values=initial_attribute_values.get(str(character.id), {}),
        )
        db.add(sc)
        session_chars.append(sc)

    await db.flush()
    session_by_source = {
        session_character.source_character_id: session_character
        for session_character in session_chars
        if session_character.source_character_id is not None
    }
    expressions = (await db.execute(
        select(CharacterExpression)
        .where(CharacterExpression.character_id.in_(list(session_by_source)))
        .order_by(CharacterExpression.character_id, CharacterExpression.display_order)
    )).scalars().all()
    for expression in expressions:
        session_character = session_by_source.get(expression.character_id)
        if session_character is None:
            continue
        db.add(SessionCharacterExpression(
            session_character_id=session_character.id,
            slot_key=expression.slot_key,
            display_name=expression.display_name,
            image_url=expression.image_url,
            display_order=expression.display_order,
        ))
    await db.flush()
    return session_chars


async def _create_session_backgrounds(session: SceneSession, scene_id: UUID, db: AsyncSession) -> dict[UUID, UUID]:
    """
    Clones every template background (session_id IS NULL) for this scene into
    new rows owned by this session (session_id = session.id). Mirrors
    _create_session_characters' clone-at-start pattern, fixing the gap where
    backgrounds were the one resource still shared live between every
    session and the scene's template — an author editing/deleting a
    template background used to retroactively affect every active player's
    session, since _load_scene_backgrounds read template rows directly
    rather than from a per-session copy.

    Cloning is cheap: Background only stores a name + a Cloudinary image_url
    string, so this is a plain INSERT per template background, no re-upload
    or asset duplication involved.

    Returns {template_background_id: cloned_background_id} so the caller
    (start_session) can translate scene.starting_background_id — a pointer
    into the TEMPLATE rows — into the equivalent CLONED row for this
    session's current_background_id.
    """
    templates = list((await db.execute(
        select(Background).where(Background.scene_id == scene_id, Background.session_id.is_(None)).order_by(Background.id)
    )).scalars().all())

    template_to_clone: dict[UUID, UUID] = {}
    for template in templates:
        clone = Background(scene_id=scene_id, session_id=session.id, name=template.name, image_url=template.image_url)
        db.add(clone)
        await db.flush()
        template_to_clone[template.id] = clone.id

    return template_to_clone


async def _create_turn_zero(
    session: SceneSession, scene_id: UUID, session_chars: list[SessionCharacter],
    start_choice_texts: list[str], db: AsyncSession,
) -> tuple[DialogueTurn, list[TurnMessage]]:
    turn = DialogueTurn(
        session_id=session.id, turn_number=0, input_type="system",
        player_input=None, context_change_text=None, attribute_delta={},
        background_changed_to=None, scene_event=None,
        options_presented=start_choice_texts, tokens_used=None,
    )
    db.add(turn)
    await db.flush()

    turn_messages: list[TurnMessage] = []
    for sc in sorted([sc for sc in session_chars if sc.initial_dialogue], key=lambda s: (s.position or 0)):
        tm = TurnMessage(
            turn_id=turn.id,
            session_character_id=sc.id,
            messages=[sc.initial_dialogue],  # type: ignore[list-item]
            expression_key=sc.current_expression_key,
            speaker_order=sc.position or 0,
        )
        db.add(tm)
        turn_messages.append(tm)

    await db.flush()
    return turn, turn_messages


async def _load_scene_backgrounds(scene_id: UUID, db: AsyncSession, session_id: UUID | None = None) -> list[Background]:
    """
    Load backgrounds available for a scene during gameplay.

    When session_id is provided, session-owned clones are authoritative. Only
    sessions created before clone-at-start fall back to template backgrounds.
    Returning both sets would duplicate every background in modern sessions
    and let later template edits leak into an isolated playthrough.

    When session_id is None (original/author mode), returns only template
    backgrounds — author edits must never reach a session's cloned rows.
    """
    if session_id is not None:
        session_query = select(Background).where(
            Background.scene_id == scene_id,
            Background.session_id == session_id,
        ).order_by(Background.id)
        session_backgrounds = list((await db.execute(session_query)).scalars().all())
        if session_backgrounds:
            return session_backgrounds

    query = select(Background).where(
        Background.scene_id == scene_id,
        Background.session_id.is_(None),
    ).order_by(Background.id)
    return list((await db.execute(query)).scalars().all())


# ── Scene CRUD ────────────────────────────────────────────────────────────────

@router.post("/scenes", response_model=SceneResponse, status_code=status.HTTP_201_CREATED)
async def create_scene(payload: SceneCreateRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SceneResponse:
    user_tier = await get_effective_tier(current_user.id, db)

    if payload.tier == "premium" and user_tier != "premium":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Premium-tier stories require a premium account")

    max_stories = TIER_LIMITS[user_tier]["max_stories"]
    existing_count = int(await db.scalar(select(func.count()).select_from(Scene).where(Scene.user_id == current_user.id)) or 0)
    if existing_count >= max_stories:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"{user_tier.capitalize()} accounts can have at most {max_stories} stories. Delete one to create another.")

    scene = Scene(
        user_id=current_user.id, title=payload.title, description=payload.description,
        game_mode=payload.game_mode, tier=payload.tier, is_public=payload.is_public,
        is_nsfw=payload.is_nsfw,
        # TASK-008: the client composites a cover (background + character
        # portraits) client-side and sends it on initial create — nothing to
        # "preserve" yet since this is a brand new scene, so just set it
        # directly (None is fine too, e.g. if client-side generation failed).
        scene_cover=payload.scene_cover,
    )
    db.add(scene)
    await db.flush()

    try:
        await embed_scene_setup(scene.id, db)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to set up scene lore: {exc}")

    await db.commit()
    await db.refresh(scene)
    return await _build_scene_response(scene, db)


@router.get("/scenes", response_model=list[SceneResponse])
async def list_scenes(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[SceneResponse]:
    result = await db.execute(select(Scene).where(Scene.user_id == current_user.id).order_by(Scene.updated_at.desc()))
    return [await _build_scene_response(s, db) for s in result.scalars().all()]


@router.get("/scenes/played", response_model=list[SceneResponse])
async def list_played_scenes(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[SceneResponse]:
    result = await db.execute(
        select(Scene)
        .join(SceneSession, SceneSession.scene_id == Scene.id)
        .where(
            SceneSession.user_id == current_user.id,
            Scene.user_id != current_user.id,
            Scene.is_public == True,
        )
        .distinct()
        .order_by(Scene.updated_at.desc())
    )
    return [await _build_scene_response(s, db) for s in result.scalars().all()]


@router.get("/scenes/{scene_id}", response_model=SceneResponse)
async def get_scene(scene_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SceneResponse:
    return await _build_scene_response(await _get_owned_scene(scene_id, current_user, db), db)


@router.put("/scenes/{scene_id}", response_model=SceneResponse)
async def update_scene(scene_id: UUID, payload: SceneUpdateRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SceneResponse:
    scene = await _get_owned_scene(scene_id, current_user, db)
    changed_fields = payload.model_fields_set

    if "tier" in changed_fields and payload.tier == "premium" and await get_effective_tier(current_user.id, db) != "premium":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Premium-tier stories require a premium account")

    if "title" in changed_fields and payload.title is not None:
        scene.title = payload.title
    if "description" in changed_fields:
        scene.description = payload.description
    if "game_mode" in changed_fields and payload.game_mode is not None:
        scene.game_mode = payload.game_mode
    if "is_nsfw" in changed_fields and payload.is_nsfw is not None:
        scene.is_nsfw = payload.is_nsfw
    if "tier" in changed_fields and payload.tier is not None:
        scene.tier = payload.tier
    if "is_public" in changed_fields and payload.is_public is not None:
        scene.is_public = payload.is_public

    # TASK-008: partial-update semantics — only overwrite scene_cover when
    # the client actually sent a freshly-generated one. If payload.scene_cover
    # is None (client-side cover compositing failed, e.g. CORS taint loading
    # an existing Cloudinary image, or this is a Personalized-mode save that
    # never calls this route at all), the existing scene.scene_cover value is
    # left completely untouched rather than being wiped to NULL.
    if "scene_cover" in changed_fields and payload.scene_cover is not None:
        scene.scene_cover = payload.scene_cover

    # Only the description contributes scene-level lore. A cover-only update
    # must remain a cheap metadata write and must not make another embedding call.
    if "description" in changed_fields:
        try:
            await embed_scene_setup(scene.id, db)
        except Exception as exc:
            await db.rollback()
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to update scene lore: {exc}")

    await db.commit(); await db.refresh(scene)
    return await _build_scene_response(scene, db)


@router.delete("/scenes/{scene_id}")
async def delete_scene(scene_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict[str, bool]:
    scene = await _get_owned_scene(scene_id, current_user, db)
    try:
        delete_story_assets(current_user.id, scene_id)
    except Exception:
        logger.exception("Cloudinary cleanup failed for scene %s; proceeding with DB delete anyway", scene_id)
    await db.delete(scene)
    await db.commit()
    return {"ok": True}


@router.get("/scenes/public/browse", response_model=list[SceneResponse])
async def browse_public_scenes(
    db: AsyncSession = Depends(get_db),
    # Search
    search: str | None = Query(None, max_length=100),
    # Filters
    nsfw: str | None = Query(None, pattern="^(sfw|nsfw)$"),
    tier: str | None = Query(None, pattern="^(free|premium)$"),
    game_mode: str | None = Query(None, pattern="^(normal|survival)$"),
    # Sort
    sort: str = Query("most_played", pattern="^(most_played|newest|oldest)$"),
    # Pagination
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
) -> list[SceneResponse]:
    query = select(Scene).where(Scene.is_public == True)

    # Search: title only (case-insensitive)
    if search and search.strip():
        query = query.where(Scene.title.ilike(f"%{search.strip()}%"))

    # Filters
    if nsfw == 'nsfw':
        query = query.where(Scene.is_nsfw == True)
    elif nsfw == 'sfw':
        query = query.where(Scene.is_nsfw == False)
    if tier:
        query = query.where(Scene.tier == tier)
    if game_mode:
        query = query.where(Scene.game_mode == game_mode)

    # Sort
    if sort == 'most_played':
        query = query.order_by(Scene.play_count.desc().nulls_last(), Scene.created_at.desc())
    elif sort == 'newest':
        query = query.order_by(Scene.created_at.desc())
    elif sort == 'oldest':
        query = query.order_by(Scene.created_at.asc())

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    return [await _build_scene_response(s, db) for s in result.scalars().all()]


@router.get("/scenes/public/{scene_id}", response_model=SceneResponse)
async def get_public_scene(scene_id: UUID, db: AsyncSession = Depends(get_db)) -> SceneResponse:
    scene = (await db.execute(select(Scene).where(Scene.id == scene_id, Scene.is_public == True))).scalar_one_or_none()
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    return await _build_scene_response(scene, db)


# ── Character CRUD ────────────────────────────────────────────────────────────

@router.post("/scenes/{scene_id}/characters", response_model=CharacterResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(_check_scene_character_limit_dependency)])
async def create_character(scene_id: UUID, payload: CharacterCreateRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> CharacterResponse:
    await _get_owned_scene(scene_id, current_user, db)
    character = Character(scene_id=scene_id, user_id=current_user.id, name=payload.name, description=payload.description, avatar_url=payload.avatar_url, position=payload.position, initial_dialogue=payload.initial_dialogue)
    db.add(character)
    await db.flush()

    try:
        await embed_scene_setup(scene_id, db)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to set up character lore: {exc}")

    await db.commit(); await db.refresh(character)
    return await _build_single_character_response(character, db)


@router.put("/scenes/{scene_id}/characters/{character_id}", response_model=CharacterResponse)
async def update_character(scene_id: UUID, character_id: UUID, payload: CharacterCreateRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> CharacterResponse:
    character = await _get_scene_character(scene_id, character_id, current_user, db)
    character.name = payload.name; character.description = payload.description; character.avatar_url = payload.avatar_url; character.position = payload.position; character.initial_dialogue = payload.initial_dialogue

    try:
        await embed_scene_setup(scene_id, db)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to update character lore: {exc}")

    await db.commit(); await db.refresh(character)
    return await _build_single_character_response(character, db)


@router.put("/scenes/{scene_id}/characters/{character_id}/expressions", response_model=CharacterResponse)
async def replace_character_expressions(scene_id: UUID, character_id: UUID, payload: ExpressionBulkUpdateRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> CharacterResponse:
    character = await _get_scene_character(scene_id, character_id, current_user, db)
    await db.execute(delete(CharacterExpression).where(CharacterExpression.character_id == character.id))
    for i, item in enumerate(payload.expressions):
        db.add(CharacterExpression(character_id=character.id, slot_key=item.slot_key, display_name=item.display_name, image_url=item.image_url, display_order=i))
    await db.commit()
    return await _build_single_character_response(character, db)


@router.put("/scenes/{scene_id}/characters/{character_id}/attributes", response_model=CharacterResponse)
async def update_character_attributes(scene_id: UUID, character_id: UUID, payload: AttributeUpdateRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> CharacterResponse:
    character = await _get_scene_character(scene_id, character_id, current_user, db)
    existing_by_key = {a.attr_key: a for a in (await db.execute(select(CharacterAttribute).where(CharacterAttribute.character_id == character.id))).scalars().all()}
    for i, item in enumerate(payload.attributes):
        if existing := existing_by_key.get(item.attr_key):
            existing.initial_value = item.initial_value; existing.is_visible_to_player = item.is_visible_to_player; existing.display_order = i
        else:
            db.add(CharacterAttribute(character_id=character.id, attr_key=item.attr_key, display_name=item.attr_key.replace("_", " ").title(), initial_value=item.initial_value, min_value=0, max_value=100, is_visible_to_player=item.is_visible_to_player, display_order=i))
    await db.commit()
    return await _build_single_character_response(character, db)


# ── Background CRUD ───────────────────────────────────────────────────────────

@router.post("/scenes/{scene_id}/backgrounds", response_model=BackgroundResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(_check_scene_background_limit_dependency)])
async def create_background(scene_id: UUID, payload: BackgroundCreateRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> BackgroundResponse:
    await _get_owned_scene(scene_id, current_user, db)
    bg = Background(
        scene_id=scene_id,
        name=payload.name,
        image_url=payload.image_url,
        session_id=payload.session_id,  # None for template bgs, set for personalized session bgs
    )
    db.add(bg); await db.commit(); await db.refresh(bg)
    return BackgroundResponse.model_validate(bg)


@router.put("/scenes/{scene_id}/backgrounds/{background_id}", response_model=BackgroundResponse)
async def update_background(scene_id: UUID, background_id: UUID, payload: BackgroundCreateRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> BackgroundResponse:
    bg = await _get_scene_background(scene_id, background_id, current_user, db)
    bg.name = payload.name; bg.image_url = payload.image_url
    await db.commit(); await db.refresh(bg)
    return BackgroundResponse.model_validate(bg)


@router.delete("/scenes/{scene_id}/backgrounds/{background_id}")
async def delete_background(scene_id: UUID, background_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict[str, bool]:
    scene = await _get_owned_scene(scene_id, current_user, db)
    bg = await _get_scene_background(scene_id, background_id, current_user, db)
    if scene.starting_background_id == bg.id:
        scene.starting_background_id = None
    await db.delete(bg); await db.commit()
    return {"ok": True}


@router.put("/scenes/{scene_id}/starting-background", response_model=SceneResponse)
async def set_starting_background(scene_id: UUID, payload: StartingBackgroundRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SceneResponse:
    scene = await _get_owned_scene(scene_id, current_user, db)
    bg = (await db.execute(select(Background).where(Background.id == payload.background_id, Background.scene_id == scene.id))).scalar_one_or_none()
    if bg is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Background not found in scene")
    scene.starting_background_id = bg.id
    await db.commit(); await db.refresh(scene)
    return await _build_scene_response(scene, db)


# ── Public background catalog ─────────────────────────────────────────────────

@router.get("/backgrounds/public", response_model=list[PublicBackgroundResponse])
async def list_public_backgrounds(
    category: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PublicBackgroundResponse]:
    query = select(PublicBackground).where(PublicBackground.is_active == True)
    if category:
        query = query.where(PublicBackground.category == category)
    result = await db.execute(query.order_by(PublicBackground.created_at.desc()))
    return [PublicBackgroundResponse.model_validate(b) for b in result.scalars().all()]


@router.post("/scenes/{scene_id}/backgrounds/from-public/{public_background_id}", response_model=BackgroundResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(_check_scene_background_limit_dependency)])
async def add_public_background_to_scene(
    scene_id: UUID,
    public_background_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BackgroundResponse:
    """Copies a curated public background into a scene's own backgrounds table."""
    await _get_owned_scene(scene_id, current_user, db)
    public_bg = (await db.execute(select(PublicBackground).where(PublicBackground.id == public_background_id, PublicBackground.is_active == True))).scalar_one_or_none()
    if public_bg is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Public background not found")
    bg = Background(scene_id=scene_id, name=public_bg.name, image_url=public_bg.image_url)
    db.add(bg); await db.commit(); await db.refresh(bg)
    return BackgroundResponse.model_validate(bg)


# ── Lore chunk endpoints ──────────────────────────────────────────────────────

@router.get("/scenes/{scene_id}/lore", response_model=list[LoreChunkResponse])
async def list_scene_lore(scene_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[LoreChunkResponse]:
    await _get_owned_scene(scene_id, current_user, db)
    result = await db.execute(select(LoreChunk).where(LoreChunk.scene_id == scene_id, LoreChunk.character_id.is_(None)).order_by(LoreChunk.priority.desc(), LoreChunk.created_at))
    return [LoreChunkResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/scenes/{scene_id}/lore", response_model=LoreChunkResponse, status_code=status.HTTP_201_CREATED)
async def create_scene_lore(scene_id: UUID, payload: LoreChunkCreateRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> LoreChunkResponse:
    await _get_owned_scene(scene_id, current_user, db)
    from app.services.lore_service import embed_text
    embedding = await embed_text(payload.content)
    chunk = LoreChunk(scene_id=scene_id, content=payload.content.strip(), chunk_type=payload.chunk_type, priority=payload.priority, embedding=embedding)
    db.add(chunk); await db.commit(); await db.refresh(chunk)
    return LoreChunkResponse.model_validate(chunk)


@router.delete("/scenes/{scene_id}/lore/{lore_id}")
async def delete_scene_lore(scene_id: UUID, lore_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict[str, bool]:
    await _get_owned_scene(scene_id, current_user, db)
    chunk = (await db.execute(select(LoreChunk).where(LoreChunk.id == lore_id, LoreChunk.scene_id == scene_id))).scalar_one_or_none()
    if chunk is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lore chunk not found")
    await db.delete(chunk); await db.commit()
    return {"ok": True}


@router.get("/scenes/{scene_id}/characters/{character_id}/lore", response_model=list[LoreChunkResponse])
async def list_character_lore(scene_id: UUID, character_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[LoreChunkResponse]:
    await _get_scene_character(scene_id, character_id, current_user, db)
    result = await db.execute(select(LoreChunk).where(LoreChunk.character_id == character_id).order_by(LoreChunk.priority.desc(), LoreChunk.created_at))
    return [LoreChunkResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/scenes/{scene_id}/characters/{character_id}/lore", response_model=LoreChunkResponse, status_code=status.HTTP_201_CREATED)
async def create_character_lore(scene_id: UUID, character_id: UUID, payload: LoreChunkCreateRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> LoreChunkResponse:
    character = await _get_scene_character(scene_id, character_id, current_user, db)
    from app.services.lore_service import embed_text
    embedding = await embed_text(payload.content)
    chunk = LoreChunk(scene_id=scene_id, character_id=character.id, content=payload.content.strip(), chunk_type=payload.chunk_type, priority=payload.priority, embedding=embedding)
    db.add(chunk); await db.commit(); await db.refresh(chunk)
    return LoreChunkResponse.model_validate(chunk)


@router.delete("/scenes/{scene_id}/characters/{character_id}/lore/{lore_id}")
async def delete_character_lore(scene_id: UUID, character_id: UUID, lore_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict[str, bool]:
    await _get_scene_character(scene_id, character_id, current_user, db)
    chunk = (await db.execute(select(LoreChunk).where(LoreChunk.id == lore_id, LoreChunk.character_id == character_id))).scalar_one_or_none()
    if chunk is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lore chunk not found")
    await db.delete(chunk); await db.commit()
    return {"ok": True}


# ── Scene start choices ───────────────────────────────────────────────────────

@router.get("/scenes/{scene_id}/start-choices", response_model=list[SceneStartChoiceResponse])
async def list_start_choices(scene_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[SceneStartChoiceResponse]:
    await _get_owned_scene(scene_id, current_user, db)
    result = await db.execute(select(SceneStartChoice).where(SceneStartChoice.scene_id == scene_id).order_by(SceneStartChoice.display_order))
    return [SceneStartChoiceResponse.model_validate(c) for c in result.scalars().all()]


@router.get("/scenes/public/{scene_id}/start-choices", response_model=list[SceneStartChoiceResponse])
async def list_public_start_choices(scene_id: UUID, db: AsyncSession = Depends(get_db)) -> list[SceneStartChoiceResponse]:
    scene = (await db.execute(select(Scene).where(Scene.id == scene_id, Scene.is_public == True))).scalar_one_or_none()
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    result = await db.execute(select(SceneStartChoice).where(SceneStartChoice.scene_id == scene_id).order_by(SceneStartChoice.display_order))
    return [SceneStartChoiceResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/scenes/{scene_id}/start-choices", response_model=SceneStartChoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_start_choice(scene_id: UUID, payload: SceneStartChoiceCreateRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SceneStartChoiceResponse:
    await _get_owned_scene(scene_id, current_user, db)
    count = int(await db.scalar(select(func.count()).select_from(SceneStartChoice).where(SceneStartChoice.scene_id == scene_id)) or 0)
    if count >= 5:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Maximum 5 start choices per scene")
    choice = SceneStartChoice(scene_id=scene_id, choice_text=payload.choice_text.strip(), display_order=payload.display_order)
    db.add(choice); await db.commit(); await db.refresh(choice)
    return SceneStartChoiceResponse.model_validate(choice)


@router.put("/scenes/{scene_id}/start-choices/{choice_id}", response_model=SceneStartChoiceResponse)
async def update_start_choice(scene_id: UUID, choice_id: UUID, payload: SceneStartChoiceCreateRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SceneStartChoiceResponse:
    await _get_owned_scene(scene_id, current_user, db)
    choice = (await db.execute(select(SceneStartChoice).where(SceneStartChoice.id == choice_id, SceneStartChoice.scene_id == scene_id))).scalar_one_or_none()
    if choice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Start choice not found")
    choice.choice_text = payload.choice_text.strip(); choice.display_order = payload.display_order
    await db.commit(); await db.refresh(choice)
    return SceneStartChoiceResponse.model_validate(choice)


@router.delete("/scenes/{scene_id}/start-choices/{choice_id}")
async def delete_start_choice(scene_id: UUID, choice_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict[str, bool]:
    await _get_owned_scene(scene_id, current_user, db)
    choice = (await db.execute(select(SceneStartChoice).where(SceneStartChoice.id == choice_id, SceneStartChoice.scene_id == scene_id))).scalar_one_or_none()
    if choice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Start choice not found")
    await db.delete(choice); await db.commit()
    return {"ok": True}


# ── Session endpoints ─────────────────────────────────────────────────────────

@router.post("/sessions/start", response_model=SessionResponse)
async def start_session(payload: SessionStartRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SessionResponse:
    scene = (await db.execute(select(Scene).where(Scene.id == payload.scene_id))).scalar_one_or_none()
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")

    if not scene.is_public and scene.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")

    if scene.tier == "premium" and await get_effective_tier(current_user.id, db) != "premium":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This story requires a premium account to play")

    existing = (await db.execute(
        select(SceneSession)
        .where(
            SceneSession.scene_id == scene.id,
            SceneSession.user_id == current_user.id,
            SceneSession.is_active == True,
        )
        .order_by(SceneSession.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()

    if existing is not None:
        has_chars = (await db.scalar(
            select(func.count()).select_from(SessionCharacter)
            .where(SessionCharacter.session_id == existing.id)
        ) or 0) > 0
        has_turn_zero = (await db.scalar(
            select(func.count()).select_from(DialogueTurn)
            .where(DialogueTurn.session_id == existing.id, DialogueTurn.turn_number == 0)
        ) or 0) > 0

        if has_chars and has_turn_zero:
            return await _build_session_response(existing, db)
        else:
            await db.delete(existing)
            await db.flush()

    initial_attribute_values = await _build_initial_attribute_values(scene.id, db)

    choices_result = await db.execute(
        select(SceneStartChoice).where(SceneStartChoice.scene_id == scene.id).order_by(SceneStartChoice.display_order)
    )
    start_choice_texts = [c.choice_text for c in choices_result.scalars().all()]

    session = SceneSession(
        scene_id=scene.id, user_id=current_user.id, game_mode=scene.game_mode,
        scene_description_snapshot=scene.description or "",
        scene_is_nsfw_snapshot=bool(scene.is_nsfw),
        turn_count=0, is_active=True, is_resumable=True,
        current_background_id=None,  # set below, after backgrounds are cloned
        world_events=[], history_summary=None, active_context_change=None,
        context_change_turns_remaining=0, outcome=None, outcome_message=None,
        current_choices=start_choice_texts,
    )
    db.add(session)
    await db.flush()

    session_chars = await _create_session_characters(session, scene.id, initial_attribute_values, db)

    # Clone every template background into this session's own copy (Epic
    # "session isolation" fix) — then translate scene.starting_background_id
    # (a pointer into the TEMPLATE rows) into the equivalent CLONED row, so
    # this session's current_background_id points at ITS OWN background,
    # never a shared template row.
    template_to_clone = await _create_session_backgrounds(session, scene.id, db)
    if scene.starting_background_id and scene.starting_background_id in template_to_clone:
        session.current_background_id = template_to_clone[scene.starting_background_id]
    elif template_to_clone:
        # No starting_background_id set on the scene, but templates DO exist:
        # fall back to the first cloned background rather than leaving this
        # session with no current background at all. "Never blank" applies
        # from session creation onward, not just at delete-time.
        session.current_background_id = next(iter(template_to_clone.values()))

    await snapshot_lore_to_session(scene.id, session.id, db)
    await _create_turn_zero(session, scene.id, session_chars, start_choice_texts, db)
    session.stable_prompt = await build_stable_prompt_for_session(
        session=session,
        session_chars=session_chars,
        db=db,
        scene=scene,
    )

    scene.play_count = (scene.play_count or 0) + 1

    await db.commit()
    await db.refresh(session)
    return await _build_session_response(session, db)


@router.get("/sessions/by-scene/{scene_id}", response_model=SessionResponse)
async def get_session_by_scene(scene_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SessionResponse:
    session = (await db.execute(
        select(SceneSession)
        .where(SceneSession.scene_id == scene_id, SceneSession.user_id == current_user.id, SceneSession.is_active == True, SceneSession.is_resumable == True)
        .order_by(SceneSession.updated_at.desc()).limit(1)
    )).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No session found")
    return await _build_session_response(session, db)


@router.get("/sessions/latest/by-scene/{scene_id}", response_model=SessionResponse)
async def get_latest_session_by_scene(
    scene_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    """Return the latest session, including a completed run and its ending."""
    session = (await db.execute(
        select(SceneSession)
        .where(SceneSession.scene_id == scene_id, SceneSession.user_id == current_user.id)
        .order_by(SceneSession.updated_at.desc())
        .limit(1)
    )).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No session found")
    return await _build_session_response(session, db)


@router.get("/sessions/{id}", response_model=SessionResponse)
async def get_session_state(id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SessionResponse:
    return await _build_session_response(await _get_owned_session(id, current_user, db), db)


@router.get("/sessions/{id}/backgrounds", response_model=list[BackgroundResponse])
async def list_session_backgrounds(id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[BackgroundResponse]:
    """
    Returns every background visible to this session: the scene's template
    backgrounds (session_id IS NULL) plus any personalized backgrounds
    belonging to this specific session. Thin wrapper around
    _load_scene_backgrounds, the same helper apply_turn_result already uses
    to build the in-game background picker — this route exists so the
    SceneCreatorPage frontend can load the SAME set when editing in
    Personalized mode, which previously had no way to see a session's own
    backgrounds at all (only the scene's template ones via GET /scenes/{id}).
    """
    session = await _get_owned_session(id, current_user, db)
    backgrounds = await _load_scene_backgrounds(session.scene_id, db, session_id=session.id)
    return [BackgroundResponse.model_validate(b) for b in backgrounds]


@router.put("/sessions/{id}/starting-background")
async def set_session_starting_background(
    id: UUID, payload: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """
    Personalized-mode equivalent of set_scene_starting_background — sets
    SceneSession.current_background_id directly, rather than
    Scene.starting_background_id (which is template-level and would affect
    every player, not just this one). Until this route existed, there was no
    way for the SceneCreatorPage frontend to persist a personalized starting
    background choice at all.

    payload: {"background_id": "<uuid>"}. The background must be visible to
    this session (template OR session-owned) — checked via
    _load_scene_backgrounds rather than a raw FK check, so a background
    belonging to a DIFFERENT session can't be set here even though the table
    has no DB-level constraint preventing it.
    """
    session = await _get_owned_session(id, current_user, db)
    background_id_raw = payload.get("background_id")
    if not background_id_raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="background_id is required")
    try:
        background_id = UUID(str(background_id_raw))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="background_id must be a valid UUID")

    visible_backgrounds = await _load_scene_backgrounds(session.scene_id, db, session_id=session.id)
    if not any(b.id == background_id for b in visible_backgrounds):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Background not found or not visible to this session")

    session.current_background_id = background_id
    await db.commit()
    return {"ok": True}


@router.delete("/sessions/{id}/backgrounds/{background_id}")
async def delete_session_background(
    id: UUID, background_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """
    Personalized-mode background deletion. Only ever deletes a background
    this SESSION owns (session_id == this session) — a template background
    (session_id IS NULL) can never be deleted through this route, matching
    the frontend guard in useSceneCreator.ts's removeBackground (which
    blocks removal of isOriginal: true backgrounds in personalized mode) and
    the product decision that personalized mode can't touch the shared
    template at all, only its own cloned copy of it.

    Two invariants enforced here, both explicit product requirements:
      1. A session must never end up with zero backgrounds. If this delete
         would remove the session's last background, it's rejected (403)
         rather than silently leaving the session in a broken state.
      2. If the deleted background was the session's current_background_id
         (the one active in the player's game right now), a fallback is
         picked automatically — the first remaining background for this
         session — so the player is never left with current_background_id
         pointing at a deleted row. The FK is ON DELETE SET NULL, so without
         this the player would silently lose their background mid-game with
         no explanation; picking a fallback here means the swap is at least
         a deliberate, visible choice rather than going blank.
    """
    session = await _get_owned_session(id, current_user, db)

    bg = (await db.execute(
        select(Background).where(Background.id == background_id, Background.session_id == session.id)
    )).scalar_one_or_none()
    if bg is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Background not found in this session")

    session_bg_count = int(await db.scalar(
        select(func.count()).select_from(Background).where(Background.session_id == session.id)
    ) or 0)
    if session_bg_count <= 1:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="A session must have at least one background")

    was_current = session.current_background_id == bg.id

    await db.delete(bg)
    await db.flush()
    session.stable_prompt = None

    if was_current:
        fallback = (await db.execute(
            select(Background).where(Background.session_id == session.id, Background.id != bg.id).order_by(Background.id).limit(1)
        )).scalar_one_or_none()
        # fallback is guaranteed non-None here: session_bg_count > 1 before
        # the delete means at least one other background still exists.
        session.current_background_id = fallback.id if fallback else None

    await db.commit()
    return {"ok": True}


# ── Session character CRUD (Personalized story edit mode) ────────────────────────────────────────────────
#
# These endpoints let a PLAYER (not necessarily the scene's author) add,
# edit, or remove characters within their OWN session — personalized to
# that one player, never touching the scene's template Character rows that
# every other player sees. See SessionCharacterCreateRequest/
# SessionCharacterUpdateRequest docstrings in schemas/scene.py for the exact
# semantics, and embed_session_character_setup in lore_service.py for how
# these characters get RAG-retrievable lore on top of the prompt injection
# every session character already receives via context_builder.py.
#
# Template-derived characters (is_session_only=False, cloned from the scene
# at session start) can be UPDATED here (a personalized override of their
# description/avatar for this player only) but per explicit product
# decision are NEVER deleted nor deactivated through these routes — only
# session-only characters (ones the player added themselves) can be removed.

@router.post(
    "/sessions/{session_id}/characters",
    response_model=SessionCharacterResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_check_session_character_limit_dependency)],
)
async def create_session_character(
    session_id: UUID, payload: SessionCharacterCreateRequest,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
) -> SessionCharacterResponse:
    session = await _get_owned_session(session_id, current_user, db, require_active=True)

    session_character = SessionCharacter(
        session_id=session.id,
        source_character_id=None,
        name=payload.name,
        description=payload.description,
        avatar_url=payload.avatar_url,
        voice_id=None,
        position=payload.position,
        initial_dialogue=payload.initial_dialogue,
        is_active=True,
        is_session_only=True,
        status="active",
        current_expression_key=None,
        attribute_values={},
    )
    db.add(session_character)
    await db.flush()
    session.stable_prompt = None

    try:
        await embed_session_character_setup(
            session_id=session.id, session_character_id=session_character.id,
            description=payload.description, db=db,
        )
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to set up character lore: {exc}")

    await db.commit()
    await db.refresh(session_character)
    return await _build_single_session_character_response(session_character, db)


@router.put("/sessions/{session_id}/characters/{session_character_id}", response_model=SessionCharacterResponse)
async def update_session_character(
    session_id: UUID, session_character_id: UUID, payload: SessionCharacterUpdateRequest,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
) -> SessionCharacterResponse:
    """
    Works for BOTH session-only and template-derived characters — a
    personalized edit may override a template-derived character's
    description/avatar for this player's session only; the scene's
    template Character row is never touched.
    """
    session_character = await _get_owned_session_character(session_id, session_character_id, current_user, db)

    session_character.name = payload.name
    session_character.description = payload.description
    session_character.avatar_url = payload.avatar_url
    session_character.position = payload.position
    session_character.initial_dialogue = payload.initial_dialogue
    await _invalidate_stable_prompt(session_id, db)

    try:
        await embed_session_character_setup(
            session_id=session_id, session_character_id=session_character.id,
            description=payload.description, db=db,
        )
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to update character lore: {exc}")

    await db.commit()
    await db.refresh(session_character)
    return await _build_single_session_character_response(session_character, db)


@router.delete("/sessions/{session_id}/characters/{session_character_id}")
async def delete_session_character(
    session_id: UUID, session_character_id: UUID,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """
    Hard-deletes a session-only character and its lore chunks immediately
    (explicit product decision — no soft-deactivate/age-out path for
    session characters).

    Template-derived characters (is_session_only=False) can NEVER be deleted
    or deactivated through this route — also an explicit product decision.
    Returns 403, not 404, since the character does exist and was found; the
    request is simply not permitted.
    """
    session_character = await _get_owned_session_character(session_id, session_character_id, current_user, db)

    if not session_character.is_session_only:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Template-derived characters cannot be removed in Personalized story edit",
        )

    await delete_session_character_chunks(session_character.id, db)
    await db.delete(session_character)
    await _invalidate_stable_prompt(session_id, db)
    await db.commit()
    return {"ok": True}


@router.put("/sessions/{session_id}/characters/{session_character_id}/attributes", response_model=SessionCharacterResponse)
async def update_session_character_attributes(
    session_id: UUID, session_character_id: UUID, payload: SessionCharacterAttributeUpdateRequest,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
) -> SessionCharacterResponse:
    """
    Replaces attribute_values wholesale — unlike template CharacterAttribute
    (a real table with min/max/display metadata per row), SessionCharacter
    attribute_values is a flat jsonb {attr_key: value}, so this is a direct
    column write, not row-by-row upsert logic.
    """
    session_character = await _get_owned_session_character(session_id, session_character_id, current_user, db)
    session_character.attribute_values = {item.attr_key: item.initial_value for item in payload.attributes}
    await db.commit()
    await db.refresh(session_character)
    return await _build_single_session_character_response(session_character, db)


@router.put("/sessions/{session_id}/characters/{session_character_id}/expressions", response_model=SessionCharacterResponse)
async def replace_session_character_expressions(
    session_id: UUID, session_character_id: UUID, payload: SessionCharacterExpressionBulkUpdateRequest,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
) -> SessionCharacterResponse:
    """
    Bulk-replace expression images for a session character — mirrors
    replace_character_expressions exactly, just targeting
    SessionCharacterExpression instead of CharacterExpression. Needed
    because session-only characters have no template Character row to
    attach expressions to (see SessionCharacterExpression's model docstring
    in models/scene.py).
    """
    session_character = await _get_owned_session_character(session_id, session_character_id, current_user, db)
    await db.execute(delete(SessionCharacterExpression).where(SessionCharacterExpression.session_character_id == session_character.id))
    for i, item in enumerate(payload.expressions):
        db.add(SessionCharacterExpression(
            session_character_id=session_character.id, slot_key=item.slot_key,
            display_name=item.display_name, image_url=item.image_url,
            display_order=i,
        ))
    await _invalidate_stable_prompt(session_id, db)
    await db.commit()
    return await _build_single_session_character_response(session_character, db)


async def _prepare_turn_inputs(
    payload: PlayerTurnRequest, current_user: User, db: AsyncSession,
    preloaded_session: SceneSession | None = None,
) -> tuple[SceneSession, Scene, list[SessionCharacter], str, str | None]:
    session = preloaded_session or await _get_owned_session(
        payload.session_id, current_user, db, require_active=True
    )
    if not session.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is not active")

    if int(session.turn_count or 0) >= settings.MAX_TURNS_PER_SESSION:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Session reached max turn limit ({settings.MAX_TURNS_PER_SESSION})")

    await consume_credit(current_user.id, db)

    scene = (await db.execute(select(Scene).where(Scene.id == session.scene_id))).scalar_one_or_none()
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")

    session_chars = await _load_session_characters(session.id, db)
    if not session_chars:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session has no characters")

    player_input = (payload.player_input or "").strip()
    if payload.input_type == "option" and not player_input:
        player_input = "[choice]"

    context_change = payload.context_change_text if payload.input_type == "context_change" else None

    return session, scene, session_chars, player_input, context_change


@router.post("/sessions/turn", response_model=TurnResponse)
@limiter.limit("30/minute")
async def process_turn(request: Request, payload: PlayerTurnRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> TurnResponse:
    timer = TurnTimer()
    owned_session = await _get_owned_session(
        payload.session_id, current_user, db, require_active=True
    )
    claim_id = await claim_session_turn(owned_session.id, db)
    try:
        with timer.phase("setup"):
            session, _scene, session_chars, player_input, context_change = await _prepare_turn_inputs(
                payload, current_user, db, preloaded_session=owned_session
            )

        with timer.phase("context_build"):
            context_payload = await build_turn_context(
                session=session,
                session_chars=session_chars,
                player_input=player_input,
                context_change=context_change,
                db=db,
                input_type=payload.input_type,
            )
            await db.commit()

        with timer.phase("ai_call"):
            ai_response = await run_ai_turn(
                system_prompt=context_payload["system"],
                messages=context_payload["messages"],
                cache_key=str(session.id),
            )

        turn_result = ai_response.get("data") if isinstance(ai_response, dict) else None
        if not isinstance(turn_result, dict):
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid AI response payload")

        try:
            tokens_used = int(ai_response.get("tokens_used", 0))
        except (TypeError, ValueError):
            tokens_used = 0

        with timer.phase("persistence"):
            await assert_session_turn_claim(session.id, claim_id, db)
            backgrounds = await _load_scene_backgrounds(
                session.scene_id, db, session_id=session.id
            )
            turn, turn_messages = await apply_turn_result(
                session=session,
                session_chars=session_chars,
                turn_result=turn_result,
                player_input=player_input,
                input_type=payload.input_type,
                context_change=context_change,
                tokens_used=tokens_used,
                backgrounds=backgrounds,
                db=db,
            )
            turn_response = await _build_turn_response(turn, turn_messages, session, db)

        timer.log_summary(
            session_id=session.id,
            turn_number=turn.turn_number,
            input_type=payload.input_type,
        )
        return turn_response
    finally:
        await release_session_turn(owned_session.id, claim_id, db)


@router.post("/sessions/{id}/context-change", response_model=SessionResponse)
@limiter.limit("10/minute")
async def apply_context_change(request: Request, id: UUID, payload: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SessionResponse:
    session = await _get_owned_session(id, current_user, db, require_active=True)
    raw = payload.get("context_text") if isinstance(payload, dict) else None
    context_text = raw.strip() if isinstance(raw, str) else ""
    if not context_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="context_text is required")
    claim_id = await claim_session_turn(session.id, db)
    try:
        await activate_context_change(
            session=session,
            context_text=context_text,
            db=db,
            turn_number=int(session.turn_count or 0),
        )
        await db.commit()
        await db.refresh(session)
        return await _build_session_response(session, db)
    finally:
        await release_session_turn(id, claim_id, db)


@router.post("/sessions/{id}/redo", response_model=TurnResponse)
async def redo_turn(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TurnResponse:
    session = await _get_owned_session(id, current_user, db)
    if session.game_mode == "survival":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Redo is disabled in survival mode")
    claim_id = await claim_session_turn(session.id, db)
    try:
        latest_turn = (await db.execute(
            select(DialogueTurn)
            .where(DialogueTurn.session_id == session.id, DialogueTurn.turn_number > 0)
            .order_by(DialogueTurn.turn_number.desc()).limit(1)
        )).scalar_one_or_none()
        if latest_turn is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No turn to redo")

        await consume_credit(current_user.id, db)
        original_input_type = latest_turn.input_type
        original_player_input = latest_turn.player_input or ""
        original_context_change = latest_turn.context_change_text
        replaced_turn_number = latest_turn.turn_number
        replaced_turn_id = latest_turn.id
        state_before = latest_turn.state_before

        session_chars = await _load_session_characters(session.id, db)
        restore_turn_state(state_before, session, session_chars)

        context_payload = await build_turn_context(
            session=session,
            session_chars=session_chars,
            player_input=original_player_input,
            context_change=original_context_change,
            db=db,
            input_type=original_input_type,
            exclude_turn_id=replaced_turn_id,
            exclude_lore_turn_number=replaced_turn_number,
        )
        # Discard the in-memory rollback preview and close the read transaction
        # before waiting on the provider. The original turn remains durable if
        # generation fails.
        await db.rollback()
        ai_response = await run_ai_turn(
            system_prompt=context_payload["system"],
            messages=context_payload["messages"],
            cache_key=str(id),
        )
        turn_result = ai_response.get("data") if isinstance(ai_response, dict) else None
        if not isinstance(turn_result, dict):
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid AI response payload")
        try:
            tokens_used = int(ai_response.get("tokens_used", 0))
        except (TypeError, ValueError):
            tokens_used = 0

        await assert_session_turn_claim(id, claim_id, db)
        session = (await db.execute(
            select(SceneSession).where(SceneSession.id == id)
        )).scalar_one_or_none()
        latest_turn = (await db.execute(
            select(DialogueTurn).where(DialogueTurn.id == replaced_turn_id)
        )).scalar_one_or_none()
        if session is None or latest_turn is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The turn changed while redo was generating",
            )
        session_chars = await _load_session_characters(session.id, db)
        restore_turn_state(state_before, session, session_chars)
        session.stable_prompt = context_payload["system"]

        await db.execute(delete(LoreChunk).where(
            LoreChunk.session_id == session.id,
            LoreChunk.turn_number == replaced_turn_number,
        ))
        if session.active_context_change:
            await db.execute(
                update(LoreChunk)
                .where(
                    LoreChunk.session_id == session.id,
                    LoreChunk.chunk_type == "context_change",
                    LoreChunk.content == session.active_context_change,
                )
                .values(priority=4)
            )
        await db.delete(latest_turn)
        await db.flush()

        backgrounds = await _load_scene_backgrounds(session.scene_id, db, session_id=session.id)
        turn, turn_messages = await apply_turn_result(
            session=session,
            session_chars=session_chars,
            turn_result=turn_result,
            player_input=original_player_input,
            input_type=original_input_type,
            context_change=original_context_change,
            tokens_used=tokens_used,
            backgrounds=backgrounds,
            db=db,
        )
        return await _build_turn_response(turn, turn_messages, session, db)
    except Exception:
        await db.rollback()
        raise
    finally:
        await release_session_turn(id, claim_id, db)


# reset_session() removed (2026-06) — TASK-003 replaced the in-place
# "reset" mechanism (which wiped a session's contents without ever
# deleting/recreating the SceneSession row itself) with a real Restart,
# implemented entirely on the frontend as: DELETE /sessions/{id}
# (delete_session below) → POST /sessions/start (start_session above).
# No new backend route was needed since delete_session + start_session
# together already provide the exact "delete, then create fresh" semantics
# Restart requires — see StoryPage.tsx's handleRestart.


@router.delete("/sessions/{id}")
async def delete_session(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    session = await _get_owned_session(id, current_user, db)
    await db.delete(session)
    await db.commit()
    return {"ok": True}


@router.post("/sessions/{id}/end")
async def end_session(id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict[str, bool]:
    session = await _get_owned_session(id, current_user, db)
    session.is_active = False; session.is_resumable = False; session.ended_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}
