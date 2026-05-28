# DB-backed conversation history compression service.
# Redis has been removed — history is read directly from dialogue_turns + turn_messages.
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_models import summarisation_model_candidates
from app.models.scene import DialogueTurn, SceneSession, TurnMessage

logger = logging.getLogger(__name__)

_COMPRESS_TRIGGER_TURNS = 10  # compress when turn_count hits a multiple of this
_COMPRESS_WINDOW = 10         # how many recent turns to read for building the transcript
_SUMMARY_MAX_CHARS = 3000     # re-summarise when history_summary exceeds this


def _build_transcript(turns_with_messages: list[tuple[DialogueTurn, list[TurnMessage]]]) -> str:
    """
    Build a human-readable transcript from (turn, turn_messages) pairs.
    Format:
      Player: <player_input>
      Character: <line1> <line2>
      Narrator: <scene-setting prose, time skips, transitions>
    """
    lines: list[str] = []
    for turn, messages in turns_with_messages:
        if turn.player_input:
            lines.append(f"Player: {turn.player_input.strip()}")
        for tm in sorted(messages, key=lambda m: m.speaker_order):
            if tm.messages:
                content = " ".join(str(m).strip() for m in tm.messages if m)
                if content:
                    label = "Narrator" if getattr(tm, "speaker_type", "character") == "narrator" else "Character"
                    lines.append(f"{label}: {content}")
    return "\n".join(lines)


def _fallback_summary(turns_with_messages: list[tuple[DialogueTurn, list[TurnMessage]]]) -> str:
    """Used when the AI summarisation call fails."""
    lines: list[str] = []
    for _, messages in turns_with_messages:
        for tm in messages:
            if tm.messages:
                lines.append(" ".join(str(m).strip() for m in tm.messages if m))
    compact = " ".join(lines)[:350]
    return compact or "Conversation context summary unavailable."


async def _condense_summary(bloated: str) -> str:
    """Re-summarise an over-long history_summary down to _SUMMARY_MAX_CHARS."""
    try:
        from app.services.ai_service import call_openrouter_json
        response = await call_openrouter_json(
            system_prompt=(
                "You are a concise narrative historian. "
                "The following story summary has grown too long. "
                f"Rewrite it in ≤{_SUMMARY_MAX_CHARS} characters (~400 words). "
                "Preserve character names, key decisions, relationship shifts, "
                "and world-state changes. Drop minor scene-setting details first. "
                "Return strict JSON: {\"summary\": string}."
            ),
            messages=[{"role": "user", "content": bloated}],
            model_candidates=summarisation_model_candidates(),
            max_tokens=500,
        )
        payload = response.get("data", {}) if isinstance(response, dict) else {}
        if isinstance(payload, dict):
            condensed = str(payload.get("summary") or "").strip()
            if condensed:
                # hard-truncate safety net — prefer sentence boundary
                if len(condensed) > _SUMMARY_MAX_CHARS:
                    cut = condensed[:_SUMMARY_MAX_CHARS]
                    last_period = cut.rfind(".")
                    if last_period > _SUMMARY_MAX_CHARS // 2:
                        cut = cut[: last_period + 1]
                    condensed = cut
                logger.info("Re-summarised history_summary from %d to %d chars", len(bloated), len(condensed))
                return condensed
    except Exception:
        logger.exception("Re-summarisation failed; falling back to hard truncate")

    # fallback: deterministic truncate at sentence boundary
    cut = bloated[:_SUMMARY_MAX_CHARS]
    last_period = cut.rfind(".")
    if last_period > _SUMMARY_MAX_CHARS // 2:
        cut = cut[: last_period + 1]
    return cut


async def compress_if_needed(session: SceneSession, db: AsyncSession) -> None:
    """
    Called inside apply_turn_result when session.turn_count % 10 == 0.

    Reads the last _COMPRESS_WINDOW turns (turn_number > 0) from DB,
    builds a transcript, calls Llama summarisation via OpenRouter,
    appends the new summary to session.history_summary.

    No Redis involved — pure DB read.
    Does NOT commit — the caller (apply_turn_result) commits everything together.
    """
    # Load recent turns from DB
    turns_result = await db.execute(
        select(DialogueTurn)
        .where(DialogueTurn.session_id == session.id, DialogueTurn.turn_number > 0)
        .order_by(DialogueTurn.turn_number.desc())
        .limit(_COMPRESS_WINDOW)
    )
    turns = list(reversed(turns_result.scalars().all()))

    if not turns:
        return

    # Load turn_messages for all fetched turns in one query
    turn_ids = [t.id for t in turns]
    msgs_result = await db.execute(
        select(TurnMessage)
        .where(TurnMessage.turn_id.in_(turn_ids))
        .order_by(TurnMessage.turn_id, TurnMessage.speaker_order)
    )
    msgs_by_turn: dict[UUID, list[TurnMessage]] = {}
    for tm in msgs_result.scalars().all():
        msgs_by_turn.setdefault(tm.turn_id, []).append(tm)

    turns_with_messages = [(t, msgs_by_turn.get(t.id, [])) for t in turns]
    transcript = _build_transcript(turns_with_messages)

    if not transcript.strip():
        return

    summary = ""
    try:
        # Late import to avoid circular dependency (ai_service imports history_service)
        from app.services.ai_service import call_openrouter_json
        response = await call_openrouter_json(
            system_prompt=(
                "You summarize roleplay history for long-term memory. "
                "Return strict JSON: {\"summary\": string}. "
                "Keep names, key decisions, relationship and emotional shifts, "
                "world changes, and unresolved hooks. 60-120 words."
            ),
            messages=[{"role": "user", "content": transcript}],
            model_candidates=summarisation_model_candidates(),
            max_tokens=220,
        )
        payload = response.get("data", {}) if isinstance(response, dict) else {}
        if isinstance(payload, dict):
            summary = str(payload.get("summary") or "").strip()
    except Exception:
        logger.exception("History compression failed; using fallback summary")

    if not summary:
        summary = _fallback_summary(turns_with_messages)

    previous = (session.history_summary or "").strip()
    combined = f"{previous}\n\n{summary}".strip() if previous else summary

    # ── guard: condense if the rolling summary outgrew the budget ────
    if len(combined) > _SUMMARY_MAX_CHARS:
        combined = await _condense_summary(combined)

    session.history_summary = combined
    # Caller commits — do not call db.commit() here

    # ── Fact extraction ─────────────────────────────────────────────────────
    # Second Llama call on the same transcript: extract discrete facts
    # and store each as a session-scoped lore chunk for future RAG retrieval.
    # Wrapped in its own try/except — failure here must never break the turn.
    try:
        from app.services.ai_service import call_openrouter_json
        from app.services.lore_service import store_event_as_lore
        facts_response = await call_openrouter_json(
            system_prompt=(
                "You extract discrete, self-contained facts from a roleplay transcript "
                "for long-term memory storage. "
                "Return strict JSON only: {\"facts\": [\"fact 1\", \"fact 2\", ...]}. "
                "Each fact must be a single sentence. "
                "Focus on: character decisions, relationship changes, revealed backstory, "
                "world-state changes, promises made, secrets disclosed. "
                "Maximum 8 facts. Omit trivial small-talk."
            ),
            messages=[{"role": "user", "content": transcript}],
            model_candidates=summarisation_model_candidates(),
            max_tokens=300,
        )
        facts_payload = facts_response.get("data", {}) if isinstance(facts_response, dict) else {}
        facts: list[str] = []
        if isinstance(facts_payload, dict):
            raw_facts = facts_payload.get("facts")
            if isinstance(raw_facts, list):
                facts = [str(f).strip() for f in raw_facts if f and str(f).strip()]

        for fact in facts[:8]:  # hard cap — never store more than 8 per window
            # commit=False (default): joins apply_turn_result's single commit,
            # since compress_if_needed is only ever called from inside it.
            await store_event_as_lore(session_id=session.id, event_text=fact, db=db, turn_number=session.turn_count)

    except Exception:
        logger.exception("Fact extraction failed; skipping lore chunk generation")

    # ── Chunk-lifecycle consolidation ─────────────────────────────────────────────────────
    # Separate, far-less-frequent trigger than the 10-turn summary cadence above—
    # gated on event-chunk COUNT, not turn number (see lore_consolidation.py for
    # why). Has its own try/except internally; never raises out into this
    # function, so a consolidation failure can't break compression or the turn.
    from app.services.lore_service import consolidate_event_chunks_if_needed
    await consolidate_event_chunks_if_needed(session_id=session.id, db=db)
