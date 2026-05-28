# Prompt/context assembly service for scene dialogue turns.
#
# PROMPT CACHING ARCHITECTURE (2026-06):
# The AI payload is now split into two pieces instead of one interpolated string:
#
#   1. STABLE prefix (system_prompt.txt + _build_character_identity_block) —
#      built from a session-start scene snapshot plus session-owned static data.
#      It is stored on SceneSession and stays BYTE-IDENTICAL until an
#      intentional static session edit invalidates it.
#      every turn in the same session — that exact-match is what lets Gemini's
#      implicit caching (and OpenRouter's pass-through of it) skip
#      re-processing this prefix on every turn instead of recomputing it from
#      scratch. Even one changed character (e.g. an attribute value baked into
#      this string) silently breaks every cache hit for the rest of the
#      session — no error, just no savings, which is why dynamic state is
#      physically forbidden from this function's output, not just
#      conventionally avoided.
#
#   2. VOLATILE suffix (dynamic_context_prompt.txt + _build_character_dynamic_state) —
#      built fresh every turn from data that changes every turn (attribute
#      values, active behavior triggers, world events, history summary, lore
#      chunks, the player's new input). Sent as a separate message appended
#      right before the player's current turn, NOT mixed into the system
#      message. This is what the message array actually looks like per turn:
#        [system: STABLE]  [...history...]  [user: VOLATILE + player input]
#
# Why this split exists: before this, the entire system prompt (including
# lore/history/attributes) was rebuilt via one .format() call every turn,
# meaning the "system" message was a different string on every single
# request — implicit caching could never hit, because there was no stable
# prefix for the provider to recognize.
import json
import logging
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scene import (
    Background,
    DialogueTurn,
    Scene,
    SceneSession,
    SessionCharacter,
    SessionCharacterExpression,
    TurnMessage,
)
from app.core.config import settings
from app.core.trigger_presets import TRIGGER_PRESETS
from app.services.lore_service import search_relevant_lore

logger = logging.getLogger(__name__)


# ── Load prompt templates once at module import ────────────────────────────────
_STABLE_PROMPT_PATH = Path(__file__).parent.parent / "core" / "system_prompt.txt"
_STABLE_PROMPT_TEMPLATE: str = _STABLE_PROMPT_PATH.read_text(encoding="utf-8")

_DYNAMIC_PROMPT_PATH = Path(__file__).parent.parent / "core" / "dynamic_context_prompt.txt"
_DYNAMIC_PROMPT_TEMPLATE: str = _DYNAMIC_PROMPT_PATH.read_text(encoding="utf-8")


# ── Trigger evaluation ────────────────────────────────────────────────────────

def evaluate_triggers(attributes: dict) -> list[str]:
    active: list[str] = []
    for attr_key, value in attributes.items():
        rules = TRIGGER_PRESETS.get(attr_key)
        if not rules:
            continue
        try:
            current = float(value)
        except (TypeError, ValueError):
            continue
        for rule in rules:
            operator  = rule["operator"]
            threshold = float(rule["threshold"])
            hit = (
                (operator == "<" and current < threshold)
                or (operator == ">" and current > threshold)
            )
            if hit:
                active.append(rule["behavior"])
    return active


# ── Character context builders — split for prompt-cache eligibility ─────────────

def _build_character_identity_block(
    session_chars: list[SessionCharacter],
    valid_expressions_by_char: dict[str, list[str]],
) -> str:
    """
    STABLE — goes into the cached system prompt. Only fields that cannot
    change for the lifetime of a session: name, session_character_id,
    description, position, and the character's defined expression slots.
    """
    blocks: list[str] = []
    for sc in session_chars:
        if not sc.is_active:
            continue
        exprs = valid_expressions_by_char.get(str(sc.id), ["neutral"])
        blocks.append(
            f"NAME: {sc.name}\n"
            f"session_character_id: {sc.id}\n"
            f"Description: {sc.description or '(none)'}\n"
            f"Position: {sc.position}\n"
            f"Valid Expressions: {', '.join(exprs)}"
        )
    return "\n\n".join(blocks) if blocks else "(no active characters)"


def _build_character_dynamic_state(session_chars: list[SessionCharacter]) -> str:
    """
    VOLATILE — goes into the per-turn dynamic context message, rebuilt fresh
    every turn.
    """
    blocks: list[str] = []
    for sc in session_chars:
        if not sc.is_active:
            continue
        attrs_json = json.dumps(sc.attribute_values or {}, ensure_ascii=True)
        active_triggers = evaluate_triggers(sc.attribute_values or {})
        trigger_lines = "\n".join(f"  - {t}" for t in active_triggers) or "  (none active)"
        blocks.append(
            f"{sc.name} (session_character_id: {sc.id})\n"
            f"  Status: {sc.status}\n"
            f"  Current Attributes: {attrs_json}\n"
            f"  Active Behaviors:\n{trigger_lines}"
        )
    return "\n\n".join(blocks) if blocks else "(no active characters)"


def fill_stable_prompt(
    scene: Scene,
    session_chars: list[SessionCharacter],
    valid_expressions_by_char: dict[str, list[str]],
    valid_backgrounds: list[str],
    is_nsfw: bool = False,
    scene_description: str | None = None,
    game_mode: str | None = None,
) -> str:
    character_profiles = _build_character_identity_block(session_chars, valid_expressions_by_char)
    backgrounds_str    = ", ".join(valid_backgrounds) if valid_backgrounds else "(none defined)"
    content_policy     = (
        ""
        if is_nsfw else
        "Do not generate sexual content. Do not generate graphic gore or extreme violence.\n"
    )
    return _STABLE_PROMPT_TEMPLATE.format(
        scene_description  = (scene_description if scene_description is not None else scene.description or "(no description provided)").strip(),
        game_mode          = (game_mode or scene.game_mode).upper(),
        character_profiles = character_profiles,
        valid_backgrounds  = backgrounds_str,
        content_policy     = content_policy,
    )


def fill_dynamic_context(
    session_chars: list[SessionCharacter],
    lore_chunks: list[str],
    history_summary: str | None,
    current_background_name: str | None,
    input_type: str,
    player_input: str,
    context_change: str | None,
    world_events: list[str],
) -> str:
    character_dynamic_state = _build_character_dynamic_state(session_chars)
    lore_block         = "\n".join(f"- {c}" for c in lore_chunks if c.strip()) or "(no relevant lore found)"
    world_events_block = "\n".join(f"{i+1}. {e}" for i, e in enumerate(world_events)) or "(none so far)"
    return _DYNAMIC_PROMPT_TEMPLATE.format(
        character_dynamic_state = character_dynamic_state,
        current_background      = current_background_name or "unknown",
        world_events            = world_events_block,
        history_summary         = (history_summary or "No history yet.").strip(),
        lore_chunks             = lore_block,
        input_type              = input_type,
        player_input            = player_input or "(no input)",
        context_change          = context_change.strip() if context_change and context_change.strip() else "(none)",
    )


async def _load_valid_expressions(
    session_chars: list[SessionCharacter],
    db: AsyncSession,
) -> dict[str, list[str]]:
    char_ids = [sc.id for sc in session_chars if sc.is_active]
    expressions_by_char: dict[UUID, list[str]] = {char_id: [] for char_id in char_ids}
    if char_ids:
        result = await db.execute(
            select(SessionCharacterExpression)
            .where(SessionCharacterExpression.session_character_id.in_(char_ids))
            .order_by(
                SessionCharacterExpression.session_character_id,
                SessionCharacterExpression.display_order,
            )
        )
        for expression in result.scalars().all():
            expressions_by_char.setdefault(expression.session_character_id, []).append(expression.slot_key)

    return {
        str(sc.id): list(dict.fromkeys(["neutral", *expressions_by_char.get(sc.id, [])]))
        for sc in session_chars
        if sc.is_active
    }


async def _load_valid_background_names(session: SceneSession, db: AsyncSession) -> list[str]:
    result = await db.execute(
        select(Background)
        .where(Background.scene_id == session.scene_id, Background.session_id == session.id)
        .order_by(Background.id)
    )
    backgrounds = list(result.scalars().all())
    if not backgrounds:
        legacy_result = await db.execute(
            select(Background)
            .where(Background.scene_id == session.scene_id, Background.session_id.is_(None))
            .order_by(Background.id)
        )
        backgrounds = list(legacy_result.scalars().all())
    return [background.name for background in backgrounds]


async def build_stable_prompt_for_session(
    session: SceneSession,
    session_chars: list[SessionCharacter],
    db: AsyncSession,
    scene: Scene | None = None,
) -> str:
    """Build the cacheable prefix from session snapshots and owned clones."""
    if scene is None:
        scene = (await db.execute(select(Scene).where(Scene.id == session.scene_id))).scalar_one_or_none()
    if scene is None:
        raise ValueError("Scene not found for session")

    description = (
        session.scene_description_snapshot
        if session.scene_description_snapshot is not None
        else scene.description
    )
    is_nsfw = (
        session.scene_is_nsfw_snapshot
        if session.scene_is_nsfw_snapshot is not None
        else bool(scene.is_nsfw)
    )
    return fill_stable_prompt(
        scene=scene,
        session_chars=[sc for sc in session_chars if sc.is_active],
        valid_expressions_by_char=await _load_valid_expressions(session_chars, db),
        valid_backgrounds=await _load_valid_background_names(session, db),
        is_nsfw=bool(is_nsfw),
        scene_description=description or "(no description provided)",
        game_mode=session.game_mode,
    )


# ── Recent turn history ───────────────────────────────────────────────────────

async def _get_recent_history(
    session_id: UUID,
    db: AsyncSession,
    limit: int = 8,
    exclude_turn_id: UUID | None = None,
) -> list[dict]:
    query = select(DialogueTurn).where(
        DialogueTurn.session_id == session_id,
        DialogueTurn.turn_number > 0,
    )
    if exclude_turn_id is not None:
        query = query.where(DialogueTurn.id != exclude_turn_id)
    result = await db.execute(
        query.order_by(DialogueTurn.turn_number.desc()).limit(limit)
    )
    turns = list(reversed(result.scalars().all()))

    sc_result = await db.execute(
        select(SessionCharacter.id, SessionCharacter.name).where(SessionCharacter.session_id == session_id)
    )
    name_by_sc_id: dict[str, str] = {str(row[0]): row[1] for row in sc_result.all()}

    turn_ids = [turn.id for turn in turns]
    messages_by_turn: dict[UUID, list[TurnMessage]] = {turn_id: [] for turn_id in turn_ids}
    if turn_ids:
        tm_result = await db.execute(
            select(TurnMessage)
            .where(TurnMessage.turn_id.in_(turn_ids))
            .order_by(TurnMessage.turn_id, TurnMessage.speaker_order)
        )
        for turn_message in tm_result.scalars().all():
            messages_by_turn.setdefault(turn_message.turn_id, []).append(turn_message)

    messages: list[dict] = []
    for turn in turns:
        user_parts: list[str] = []
        if turn.player_input:
            user_parts.append(turn.player_input)
        if turn.input_type == "context_change" and turn.context_change_text:
            user_parts.append(f"[Context Change] {turn.context_change_text}")
        if user_parts:
            messages.append({"role": "user", "content": "\n".join(user_parts)})

        for tm in messages_by_turn.get(turn.id, []):
            if not tm.messages:
                continue
            content = " ".join(tm.messages)
            if getattr(tm, "speaker_type", "character") == "narrator":
                prefix = "[Narrator]"
            else:
                prefix = name_by_sc_id.get(str(tm.session_character_id), "Character")
            messages.append({"role": "assistant", "content": f"{prefix}: {content}"})
    return messages


# ── Main entry point ──────────────────────────────────────────────────────────

async def build_turn_context(
    session: SceneSession,
    session_chars: list[SessionCharacter],
    player_input: str,
    context_change: str | None,
    db: AsyncSession,
    input_type: str = "prompt",
    exclude_turn_id: UUID | None = None,
    exclude_lore_turn_number: int | None = None,
) -> dict:
    scene_result = await db.execute(select(Scene).where(Scene.id == session.scene_id))
    scene = scene_result.scalar_one_or_none()
    if scene is None:
        raise ValueError("Scene not found for session")

    identity_chars = [sc for sc in session_chars if sc.is_active]
    active_chars   = [sc for sc in session_chars if sc.is_active and sc.status == "active"]
    if not active_chars:
        raise ValueError("No active characters in session")

    # ── Expression slot keys ──────────────────────────────────────────────────
    # ── Current background name ───────────────────────────────────────────────
    current_background_name: str | None = None
    if session.current_background_id:
        bg = (await db.execute(
            select(Background).where(Background.id == session.current_background_id)
        )).scalar_one_or_none()
        if bg:
            current_background_name = bg.name

    # ── All background names available in this session ────────────────────────
    # ── Effective context change ──────────────────────────────────────────────
    effective_context_change = context_change if context_change is not None else session.active_context_change

    # ── RAG query ─────────────────────────────────────────────────────────────
    lore_query = player_input
    if effective_context_change and effective_context_change.strip():
        lore_query = f"{player_input}\nContext Change: {effective_context_change.strip()}"

    source_char_ids = [sc.source_character_id for sc in active_chars if sc.source_character_id]
    sc_ids          = [sc.id for sc in active_chars]

    # ── Parallel fetch: history + lore ────────────────────────────────────────
    history_messages = await _get_recent_history(
        session.id, db, exclude_turn_id=exclude_turn_id
    )
    lore_chunks = await search_relevant_lore(
        query=lore_query,
        scene_id=session.scene_id,
        session_id=session.id,
        character_ids=source_char_ids,
        session_char_ids=sc_ids,
        top_k=4,
        similarity_threshold=0.70,
        current_turn_number=int(session.turn_count or 0),
        excluded_turn_number=exclude_lore_turn_number,
        db=db,
    )

    # ── Fill templates ────────────────────────────────────────────────────────
    system_prompt = session.stable_prompt
    if not system_prompt:
        system_prompt = await build_stable_prompt_for_session(
            session=session,
            session_chars=identity_chars,
            db=db,
            scene=scene,
        )
        session.stable_prompt = system_prompt

    dynamic_context = fill_dynamic_context(
        session_chars=active_chars,
        lore_chunks=lore_chunks,
        history_summary=session.history_summary,
        current_background_name=current_background_name,
        input_type=input_type,
        player_input=player_input,
        context_change=effective_context_change,
        world_events=list(session.world_events or []),
    )

    result = {
        "system": system_prompt,
        "messages": [*history_messages, {"role": "user", "content": dynamic_context}],
    }

    if settings.LOG_FULL_PROMPTS:
        logger.info(
            "\n" + "=" * 80 +
            "\n[TURN PROMPT] session=%s turn=%s input_type=%s\n" +
            "-" * 80 +
            "\n--- SYSTEM PROMPT ---\n%s\n" +
            "-" * 80 +
            "\n--- MESSAGES (%d) ---\n%s\n" +
            "=" * 80,
            session.id, int(session.turn_count or 0), input_type,
            system_prompt,
            len(result["messages"]),
            "\n".join(f"[{m['role']}] {m['content']}" for m in result["messages"]),
        )

    return result
