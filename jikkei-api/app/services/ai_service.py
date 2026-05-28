# AI provider integration and turn-application service.
import json
import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any, AsyncGenerator
from uuid import UUID

import httpx
from openai import AsyncOpenAI
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_models import dialogue_model_candidates_for_tier, summarisation_model_candidates
from app.core.config import settings
from app.models.scene import Background, CharacterAttribute, DialogueTurn, SceneSession, SessionCharacter, TurnMessage
from app.services.lore_service import activate_context_change, store_event_as_lore
from app.services.turn_snapshot import capture_turn_state

_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
_openrouter_client: AsyncOpenAI | None = None
logger = logging.getLogger(__name__)


def _strip_code_fences(raw_text: str) -> str:
    text_value = raw_text.strip()
    if text_value.startswith("```"):
        lines = text_value.splitlines()
        lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text_value = "\n".join(lines).strip()
    return text_value


def _normalize_messages(messages: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        normalized.append({
            "role": str(message.get("role", "user") or "user"),
            "content": str(message.get("content", "") or ""),
        })
    return normalized


def _parse_json_payload(raw_text: str) -> dict:
    cleaned = _strip_code_fences(raw_text)
    parsed = json.loads(cleaned)
    if not isinstance(parsed, dict):
        raise ValueError("AI response JSON must be an object")
    return parsed


def _usage_token_count(usage: Any) -> int:
    if usage is None:
        return 0
    if isinstance(usage, Mapping):
        total_tokens = usage.get("total_tokens")
        input_tokens = usage.get("input_tokens") or usage.get("prompt_tokens") or 0
        output_tokens = usage.get("output_tokens") or usage.get("completion_tokens") or 0
    else:
        total_tokens = getattr(usage, "total_tokens", None)
        input_tokens = getattr(usage, "input_tokens", None) or getattr(usage, "prompt_tokens", 0) or 0
        output_tokens = getattr(usage, "output_tokens", None) or getattr(usage, "completion_tokens", 0) or 0
    try:
        if total_tokens is not None:
            return int(total_tokens)
        return int(input_tokens) + int(output_tokens)
    except (TypeError, ValueError):
        return 0


def _usage_cache_info(usage: Any) -> tuple[int, int]:
    """
    Returns (cached_tokens, total_prompt_tokens) from an OpenRouter/OpenAI-SDK
    usage object, for prompt-cache-hit observability (Epic E5).

    OpenRouter mirrors OpenAI's usage shape: cache info lives at
    usage.prompt_tokens_details.cached_tokens. cached_tokens > 0 means the
    request's stable prefix (the STABLE system prompt built by
    context_builder.fill_stable_prompt) was recognized and reused instead of
    being reprocessed — this is the signal that the Epic E prompt split is
    actually working, not just structurally correct. A persistent 0 across
    many turns in the same session despite an unchanged system prompt means
    something is still defeating the cache (e.g. a stray volatile field that
    leaked into the stable block — see context_builder.py's module docstring).

    Defensive against missing/None fields throughout — cache info is
    diagnostic only and must never raise or block a turn.
    """
    if usage is None:
        return 0, 0
    if isinstance(usage, Mapping):
        prompt_tokens = usage.get("prompt_tokens") or usage.get("input_tokens") or 0
        details = usage.get("prompt_tokens_details")
    else:
        prompt_tokens = getattr(usage, "prompt_tokens", None) or getattr(usage, "input_tokens", None) or 0
        details = getattr(usage, "prompt_tokens_details", None)
    if isinstance(details, Mapping):
        cached = details.get("cached_tokens") or 0
    else:
        cached = getattr(details, "cached_tokens", None) or 0
    try:
        return int(cached), int(prompt_tokens)
    except (TypeError, ValueError):
        return 0, 0


def get_openrouter_client() -> AsyncOpenAI:
    global _openrouter_client
    if _openrouter_client is None:
        api_key = settings.openrouter_api_key
        if not api_key:
            raise RuntimeError("OpenRouter API key is not configured")
        _openrouter_client = AsyncOpenAI(
            api_key=api_key,
            base_url=_OPENROUTER_BASE_URL,
            timeout=settings.OPENROUTER_TIMEOUT_SECONDS,
            max_retries=settings.OPENROUTER_MAX_RETRIES,
        )
    return _openrouter_client


def _openrouter_messages(system_prompt: str, messages: list[dict]) -> list[dict]:
    # OpenRouter forwards this cache breakpoint to providers that support it.
    # Providers without prompt caching safely ignore the extra field.
    return [
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        },
        *_normalize_messages(messages),
    ]


async def _create_chat_completion(
    system_prompt: str,
    messages: list[dict],
    model: str,
    max_tokens: int,
    response_format: dict[str, str] | None = None,
    cache_key: str | None = None,
) -> Any:
    client = get_openrouter_client()
    request_kwargs: dict[str, Any] = {
        "model": str(model),
        "messages": _openrouter_messages(system_prompt, messages),
        "max_tokens": max_tokens,
        "temperature": 0.85,
    }
    if response_format is not None:
        request_kwargs["response_format"] = response_format
    if cache_key:
        request_kwargs["extra_body"] = {"session_id": cache_key}
    return await client.chat.completions.create(**request_kwargs)


def _extract_text(response: Any) -> str:
    choices = getattr(response, "choices", None)
    if not choices:
        return ""
    message = getattr(choices[0], "message", None)
    if message is None:
        return ""
    content = getattr(message, "content", None)
    return content.strip() if isinstance(content, str) else str(content or "").strip()


async def call_openrouter_text(
    system_prompt: str,
    messages: list[dict],
    model_candidates: tuple[str, ...],
    max_tokens: int = 600,
    cache_key: str | None = None,
) -> dict:
    last_error: Exception | None = None
    for model in model_candidates:
        try:
            response = await _create_chat_completion(
                system_prompt, messages, model, max_tokens, cache_key=cache_key
            )
            text = _extract_text(response)
            if text:
                return {
                    "text": text,
                    "tokens_used": _usage_token_count(getattr(response, "usage", None)),
                    "model": model,
                }
            last_error = RuntimeError("OpenRouter response did not include text")
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"OpenRouter text generation failed: {last_error}") from last_error


async def stream_openrouter_text(
    system_prompt: str,
    messages: list[dict],
    model_candidates: tuple[str, ...],
    max_tokens: int = 600,
    cache_key: str | None = None,
    usage_out: dict[str, int | str] | None = None,
) -> AsyncGenerator[str, None]:
    client = get_openrouter_client()
    last_error: Exception | None = None
    for model in model_candidates:
        yielded_any = False
        try:
            request_kwargs: dict[str, Any] = {
                "model": str(model),
                "messages": _openrouter_messages(system_prompt, messages),
                "max_tokens": max_tokens,
                "temperature": 0.85,
                "stream": True,
                "stream_options": {"include_usage": True},
            }
            if cache_key:
                request_kwargs["extra_body"] = {"session_id": cache_key}
            stream = await client.chat.completions.create(
                **request_kwargs,
            )
            async for chunk in stream:
                # Usage info (Epic E5 cache observability) arrives in the final
                # SSE chunk and has no 'choices', or has empty 'choices' —
                # check it before the 'no choices -> skip' continue below, or
                # this data is silently lost on every streamed turn.
                chunk_usage = getattr(chunk, "usage", None)
                if chunk_usage is not None:
                    cached_tokens, prompt_tokens = _usage_cache_info(chunk_usage)
                    if usage_out is not None:
                        usage_out.update({
                            "model": model,
                            "tokens_used": _usage_token_count(chunk_usage),
                            "cached_tokens": cached_tokens,
                            "prompt_tokens": prompt_tokens,
                        })
                    logger.info(
                        "PROMPT_CACHE model=%s cached_tokens=%d prompt_tokens=%d hit=%s (streamed)",
                        model, cached_tokens, prompt_tokens, cached_tokens > 0,
                    )
                choices = getattr(chunk, "choices", None)
                if not choices:
                    continue
                delta = getattr(choices[0], "delta", None)
                if delta is None:
                    continue
                token = getattr(delta, "content", None)
                if token:
                    yielded_any = True
                    yield token
            return
        except Exception as exc:
            if yielded_any:
                raise RuntimeError(
                    f"OpenRouter stream interrupted after output began: {exc}"
                ) from exc
            last_error = exc
    raise RuntimeError(f"OpenRouter streaming failed: {last_error}") from last_error


async def call_openrouter_json(
    system_prompt: str,
    messages: list[dict],
    model_candidates: tuple[str, ...],
    max_tokens: int = 600,
    cache_key: str | None = None,
) -> dict:
    last_error: Exception | None = None
    for model in model_candidates:
        try:
            response = await _create_chat_completion(
                system_prompt, messages, model, max_tokens,
                response_format={"type": "json_object"},
                cache_key=cache_key,
            )
            response_text = _extract_text(response)
            if not response_text:
                last_error = RuntimeError("OpenRouter response did not include JSON text")
                continue
            parsed = _parse_json_payload(response_text)
            usage = getattr(response, "usage", None)
            cached_tokens, prompt_tokens = _usage_cache_info(usage)
            # LORE_BUDGET-style observability for Epic E5 — lets you confirm the
            # stable/volatile prompt split is actually producing cache hits,
            # not just structurally correct. See _usage_cache_info's docstring.
            logger.info(
                "PROMPT_CACHE model=%s cached_tokens=%d prompt_tokens=%d hit=%s",
                model, cached_tokens, prompt_tokens, cached_tokens > 0,
            )
            return {
                "data": parsed,
                "tokens_used": _usage_token_count(usage),
                "model": model,
                "cached_tokens": cached_tokens,
                "prompt_tokens": prompt_tokens,
            }
        except (json.JSONDecodeError, ValueError) as parse_error:
            last_error = parse_error
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"OpenRouter JSON generation failed: {last_error}") from last_error


_GEMINI_DIRECT_MODEL = "gemini-2.5-flash"
_GEMINI_DIRECT_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{_GEMINI_DIRECT_MODEL}:generateContent"
_GEMINI_STREAM_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{_GEMINI_DIRECT_MODEL}:streamGenerateContent?alt=sse"
_GEMINI_CACHE_MIN_TOKENS = 2048
_DIALOGUE_MAX_OUTPUT_TOKENS = 4096


def _build_gemini_payload(system_prompt: str, messages: list[dict]) -> dict:
    contents = []
    for msg in _normalize_messages(messages):
        role = "model" if msg["role"] == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": msg["content"]}]})
    return {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "generationConfig": {
            "temperature": 0.85,
            "responseMimeType": "application/json",
            "maxOutputTokens": _DIALOGUE_MAX_OUTPUT_TOKENS,
        },
    }


def _record_gemini_usage(
    usage: Mapping[str, Any],
    usage_out: dict[str, int | str] | None = None,
    *,
    streamed: bool = False,
) -> tuple[int, int, int]:
    tokens_used = int(usage.get("totalTokenCount") or 0)
    cached_tokens = int(usage.get("cachedContentTokenCount") or 0)
    prompt_tokens = int(usage.get("promptTokenCount") or 0)
    eligibility = "eligible" if prompt_tokens >= _GEMINI_CACHE_MIN_TOKENS else "below_minimum"
    logger.info(
        "PROMPT_CACHE model=%s cached_tokens=%d prompt_tokens=%d hit=%s eligibility=%s streamed=%s",
        _GEMINI_DIRECT_MODEL,
        cached_tokens,
        prompt_tokens,
        cached_tokens > 0,
        eligibility,
        streamed,
    )
    if usage_out is not None:
        usage_out.update({
            "model": _GEMINI_DIRECT_MODEL,
            "tokens_used": tokens_used,
            "cached_tokens": cached_tokens,
            "prompt_tokens": prompt_tokens,
            "cache_eligibility": eligibility,
        })
    return tokens_used, cached_tokens, prompt_tokens


async def _call_gemini_direct_json(system_prompt: str, messages: list[dict]) -> dict:
    """
    Direct Google AI Studio call — bypasses OpenRouter entirely for max rate limits.
    Matches the working curl: POST generateContent with x-goog-api-key header.

    Gemini's API has no separate "system" role — system_prompt is passed via
    systemInstruction, and conversation turns map role 'assistant' -> 'model'.
    responseMimeType: application/json enforces JSON output (equivalent to
    OpenRouter's response_format={'type': 'json_object'}).
    """
    api_key = settings.GOOGLE_AI_STUDIO_API_KEY
    if not api_key:
        raise ValueError("GOOGLE_AI_STUDIO_API_KEY not configured")

    payload = _build_gemini_payload(system_prompt, messages)

    async with httpx.AsyncClient(timeout=settings.GEMINI_DIRECT_TIMEOUT_SECONDS) as client:
        response = await client.post(
            _GEMINI_DIRECT_URL,
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError("Gemini response had no candidates")
    parts = candidates[0].get("content", {}).get("parts") or []
    raw_text = "".join(p.get("text", "") for p in parts).strip()
    if not raw_text:
        raise RuntimeError("Gemini response had no text content")

    parsed = _parse_json_payload(raw_text)

    usage = data.get("usageMetadata") or {}
    tokens_used, cached_tokens, prompt_tokens = _record_gemini_usage(usage)

    return {
        "data": parsed,
        "tokens_used": tokens_used,
        "model": _GEMINI_DIRECT_MODEL,
        "cached_tokens": cached_tokens,
        "prompt_tokens": prompt_tokens,
    }


async def stream_ai_turn(
    system_prompt: str,
    messages: list[dict],
    cache_key: str | None = None,
    usage_out: dict[str, int | str] | None = None,
) -> AsyncGenerator[str, None]:
    """Stream JSON from direct Gemini, falling back before output starts."""
    if settings.GOOGLE_AI_STUDIO_API_KEY:
        yielded_any = False
        try:
            payload = _build_gemini_payload(system_prompt, messages)
            async with httpx.AsyncClient(timeout=settings.GEMINI_DIRECT_TIMEOUT_SECONDS) as client:
                async with client.stream(
                    "POST",
                    _GEMINI_STREAM_URL,
                    headers={
                        "x-goog-api-key": settings.GOOGLE_AI_STUDIO_API_KEY,
                        "Content-Type": "application/json",
                    },
                    json=payload,
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        raw_event = line.removeprefix("data:").strip()
                        if not raw_event or raw_event == "[DONE]":
                            continue
                        event = json.loads(raw_event)
                        usage = event.get("usageMetadata") or {}
                        if usage:
                            _record_gemini_usage(usage, usage_out, streamed=True)
                        candidates = event.get("candidates") or []
                        if not candidates:
                            continue
                        parts = candidates[0].get("content", {}).get("parts") or []
                        token = "".join(part.get("text", "") for part in parts)
                        if token:
                            yielded_any = True
                            yield token
            return
        except Exception as exc:
            if yielded_any:
                raise RuntimeError(
                    f"Direct Gemini stream interrupted after output began: {exc}"
                ) from exc
            logger.warning("Direct Gemini stream failed, falling back to OpenRouter: %s", exc)

    async for token in stream_openrouter_text(
        system_prompt=system_prompt,
        messages=messages,
        model_candidates=dialogue_model_candidates_for_tier("free"),
        max_tokens=_DIALOGUE_MAX_OUTPUT_TOKENS,
        cache_key=cache_key,
        usage_out=usage_out,
    ):
        yield token


async def run_ai_turn(
    system_prompt: str,
    messages: list[dict],
    cache_key: str | None = None,
) -> dict:
    """
    Direct Google AI Studio Gemini call (main), falls back to OpenRouter
    (Gemini + budget models) only if the direct call fails.
    """
    if settings.GOOGLE_AI_STUDIO_API_KEY:
        try:
            return await _call_gemini_direct_json(system_prompt, messages)
        except Exception as exc:
            logger.warning("Direct Gemini call failed, falling back to OpenRouter: %s", exc)

    return await call_openrouter_json(
        system_prompt=system_prompt,
        messages=messages,
        model_candidates=dialogue_model_candidates_for_tier("free"),
        max_tokens=_DIALOGUE_MAX_OUTPUT_TOKENS,
        cache_key=cache_key,
    )


# ── Turn application ──────────────────────────────────────────────────────────

def _extract_options(turn_result: dict) -> list[str]:
    # System prompt instructs AI to output 'choices' — check that first, then fallbacks
    raw = turn_result.get("choices") or turn_result.get("options_presented") or turn_result.get("options")
    if not isinstance(raw, list):
        return []
    return [str(o) for o in raw if o is not None]


def _resolve_background_change(
    turn_result: dict, backgrounds: list[Background]
) -> tuple[UUID | None, str | None]:
    raw_value: Any = turn_result.get("background_changed_to") or turn_result.get("background")
    if raw_value is None:
        return None, None
    candidate = str(raw_value).strip()
    if not candidate:
        return None, None
    lookup_by_id = {str(bg.id): bg for bg in backgrounds}
    lookup_by_name = {bg.name.strip().lower(): bg for bg in backgrounds if bg.name}
    matched = lookup_by_id.get(candidate) or lookup_by_name.get(candidate.lower())
    if matched is None:
        return None, candidate
    return matched.id, matched.name


def _coerce_int(value: Any, fallback: Any) -> Any:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


async def apply_turn_result(
    session: SceneSession,
    session_chars: list[SessionCharacter],
    turn_result: dict,
    player_input: str,
    input_type: str,
    context_change: str | None,
    tokens_used: int,
    backgrounds: list[Background],
    db: AsyncSession,
) -> tuple[DialogueTurn, list[TurnMessage]]:
    """
    Apply AI response to session + session_characters and persist to DB.

    The AI response may target one or multiple characters. Each character entry
    in turn_result["characters"] maps to one TurnMessage row.

    Returns (DialogueTurn, list[TurnMessage]).
    """
    now = datetime.now(timezone.utc)
    state_before = capture_turn_state(session, session_chars)

    if not isinstance(turn_result, dict):
        raise ValueError("turn_result must be a dictionary")

    # ── Index session_chars by source_character_id and by id for fast lookup ──
    sc_by_source: dict[str, SessionCharacter] = {}
    sc_by_id: dict[str, SessionCharacter] = {}
    for sc in session_chars:
        sc_by_id[str(sc.id)] = sc
        if sc.source_character_id:
            sc_by_source[str(sc.source_character_id)] = sc

    # ── Background change ──
    changed_background_id, _ = _resolve_background_change(turn_result, backgrounds)
    if changed_background_id is not None:
        session.current_background_id = changed_background_id

    # ── World events ──
    raw_scene_event = turn_result.get("scene_event")
    scene_event = raw_scene_event.strip() if isinstance(raw_scene_event, str) and raw_scene_event.strip() else None
    world_events = list(session.world_events or [])
    if scene_event:
        world_events.append(scene_event)
        # commit=False (default): this write joins apply_turn_result's single
        # commit at the end of the function — see Epic D commit-boundary fix.
        await store_event_as_lore(session_id=session.id, event_text=scene_event, db=db, turn_number=session.turn_count)
    session.world_events = world_events[-20:]

    # ── Context change countdown ──
    # active_context_change is a single-slot field: only one context change can be
    # "boosted" (priority 4, always-inject) at a time. When it's replaced or expires,
    # we demote — never delete — the previous chunk to priority 2 (semantic-search-only).
    # This keeps the fact permanently retrievable (continuous time-decay pool) while
    # stopping it from being force-injected every turn once its 3-turn boost window ends.
    if context_change and context_change.strip():
        await activate_context_change(
            session=session,
            context_text=context_change,
            db=db,
            turn_number=session.turn_count,
        )
    elif int(session.context_change_turns_remaining or 0) > 0:
        session.context_change_turns_remaining -= 1
        if session.context_change_turns_remaining <= 0:
            session.context_change_turns_remaining = 0
            session.active_context_change = None
            # Boost window expired — demote, don't delete. Fact persists, force-inject stops.
            await db.execute(
                text(
                    """
                    UPDATE lore_chunks
                    SET priority = 2
                    WHERE session_id = :session_id
                      AND chunk_type = 'context_change'
                      AND priority = 4
                    """
                ),
                {"session_id": str(session.id)},
            )

    # ── Game over ──
    if bool(turn_result.get("game_over", False)):
        session.is_active = False
        session.ended_at = now
        if isinstance(turn_result.get("outcome"), str):
            session.outcome = turn_result["outcome"]
        if isinstance(turn_result.get("outcome_message"), str):
            session.outcome_message = turn_result["outcome_message"]

    session.turn_count = int(session.turn_count or 0) + 1

    # ── Per-character response blocks ──────────────────────────────────────────
    # System prompt instructs the AI to output:
    #   {
    #     "messages": [ { "session_character_id": "...", "messages": [...], "expression_key": "...", "speaker_order": 0 } ],
    #     "attribute_delta": { "<session_character_id>": { "affection": 5 } }   ← top-level, keyed by sc id
    #   }
    #
    # Legacy fallback (single-char flat format) also supported.

    # Top-level attribute_delta keyed by session_character_id
    top_level_delta: dict[str, dict[str, Any]] = {}
    raw_top_delta = turn_result.get("attribute_delta")
    if isinstance(raw_top_delta, dict):
        for k, v in raw_top_delta.items():
            if isinstance(v, dict):
                # Keyed by session_character_id: {"<sc_id>": {"affection": 5}}
                top_level_delta[str(k)] = v
            elif isinstance(v, (int, float)):
                # Flat format fallback: {"affection": 5} — assign to primary char later
                top_level_delta["__flat__"] = raw_top_delta  # type: ignore[assignment]
                break

    # Resolve character message blocks from 'messages' key (system prompt format)
    char_blocks: list[dict] = []
    raw_messages_blocks = turn_result.get("messages")
    if isinstance(raw_messages_blocks, list) and raw_messages_blocks and isinstance(raw_messages_blocks[0], dict):
        # New format: messages is an array of character objects
        char_blocks = [b for b in raw_messages_blocks if isinstance(b, dict)]
    else:
        # Legacy / characters key fallback
        raw_chars = turn_result.get("characters")
        if isinstance(raw_chars, list) and raw_chars:
            char_blocks = [b for b in raw_chars if isinstance(b, dict)]
        else:
            # Fully flat single-char fallback
            primary = next((sc for sc in session_chars if sc.is_active and sc.status == "active"), None)
            if primary:
                flat_delta = top_level_delta.pop("__flat__", {}) or {}
                char_blocks = [{
                    "session_character_id": str(primary.id),
                    "messages": raw_messages_blocks if isinstance(raw_messages_blocks, list) else [turn_result.get("dialogue_text", "...")],
                    "expression_key": turn_result.get("expression_key", "default"),
                    "attribute_delta": flat_delta,
                    "speaker_order": 0,
                }]

    # ── Apply per-character attribute deltas and expression changes ──────────
    aggregate_delta: dict[str, int] = {}  # summed across all chars for DialogueTurn.attribute_delta
    turn_message_rows: list[tuple] = []
    stable_identity_changed = False

    for speaker_order, block in enumerate(char_blocks):
        # ── Narrator block ── belongs to no character, skips attribute/expression logic entirely
        speaker_type = str(block.get("speaker_type", "character") or "character").strip().lower()
        if speaker_type == "narrator":
            raw_messages = block.get("messages")
            if isinstance(raw_messages, list) and raw_messages:
                messages_list = [str(m).strip() for m in raw_messages if m]
            else:
                messages_list = ["..."]
            turn_message_rows.append((None, messages_list, None, block.get("speaker_order", speaker_order), {}, None, None))
            continue

        # Resolve which session_character this block targets
        sc: SessionCharacter | None = None
        if "session_character_id" in block:
            sc = sc_by_id.get(str(block["session_character_id"]))
        elif "character_id" in block:
            # AI may return template character_id — map to session copy
            sc = sc_by_source.get(str(block["character_id"]))
        if sc is None:
            # Fallback: use primary active character
            sc = next((s for s in session_chars if s.is_active and s.status == "active"), None)
        if sc is None:
            continue

        # Apply attribute delta to session_character.attribute_values
        existing_vals: dict[str, int] = dict(sc.attribute_values or {})
        # Pull delta: prefer top-level keyed format, fall back to inline block delta
        requested_delta = top_level_delta.get(str(sc.id)) or block.get("attribute_delta") or {}
        if not isinstance(requested_delta, dict):
            requested_delta = {}

        # Load attribute definitions for clamping
        attr_result = await db.execute(
            select(CharacterAttribute)
            .where(CharacterAttribute.character_id == sc.source_character_id)
            .order_by(CharacterAttribute.display_order)
        ) if sc.source_character_id else None

        attr_defs_by_key: dict[str, CharacterAttribute] = {}
        if attr_result:
            for a in attr_result.scalars().all():
                attr_defs_by_key[a.attr_key] = a

        applied_delta: dict[str, int] = {}
        updated_vals: dict[str, int] = dict(existing_vals)
        for key, raw_delta in requested_delta.items():
            delta = _coerce_int(raw_delta, 0)
            if delta == 0:
                continue
            baseline = _coerce_int(existing_vals.get(key), 0)
            new_val = baseline + delta
            attr_def = attr_defs_by_key.get(key)
            if attr_def:
                new_val = max(int(attr_def.min_value), min(int(attr_def.max_value), new_val))
            updated_vals[key] = new_val
            applied_delta[key] = new_val - baseline
            aggregate_delta[key] = aggregate_delta.get(key, 0) + applied_delta[key]

        sc.attribute_values = updated_vals

        # Update expression
        expression_key = block.get("expression_key")
        if isinstance(expression_key, str) and expression_key.strip():
            sc.current_expression_key = expression_key.strip()

        # Apply status/is_active changes from this turn's AI response, if present.
        # Both default to unchanged when omitted — the AI only sets these when a
        # character's presence actually changes this turn. resulting_status /
        # resulting_is_active stay None unless a change was actually applied here
        # (TASK-009) — that distinction is what lets the frontend defer the visual
        # disappearance to dialogue playback instead of applying it instantly.
        resulting_status: str | None = None
        resulting_is_active: bool | None = None

        raw_status = block.get("status")
        if isinstance(raw_status, str) and raw_status.strip().lower() in ("active", "inactive"):
            sc.status = raw_status.strip().lower()
            resulting_status = sc.status

        raw_is_active = block.get("is_active")
        if isinstance(raw_is_active, bool):
            if sc.is_active != raw_is_active:
                stable_identity_changed = True
            sc.is_active = raw_is_active
            resulting_is_active = sc.is_active

        # Build messages list
        raw_messages = block.get("messages")
        if isinstance(raw_messages, list) and raw_messages:
            messages_list = [str(m).strip() for m in raw_messages if m]
        else:
            raw_text = block.get("dialogue_text", "")
            messages_list = [str(raw_text).strip() if raw_text else "..."]

        turn_message_rows.append((sc, messages_list, expression_key or "default", block.get("speaker_order", speaker_order), applied_delta, resulting_status, resulting_is_active))

    if stable_identity_changed:
        session.stable_prompt = None

    # ── Persist DialogueTurn ──
    turn_record = DialogueTurn(
        session_id=session.id,
        turn_number=session.turn_count,
        input_type=input_type,
        player_input=player_input if player_input else None,
        context_change_text=context_change.strip() if isinstance(context_change, str) and context_change.strip() else None,
        attribute_delta=aggregate_delta,
        background_changed_to=changed_background_id,
        scene_event=scene_event,
        options_presented=_extract_options(turn_result),
        state_before=state_before,
        tokens_used=int(tokens_used),
        created_at=now,
    )
    db.add(turn_record)
    await db.flush()  # need turn_record.id for TurnMessage FK

    # ── Persist TurnMessage rows ──
    persisted_messages: list[TurnMessage] = []
    for sc, messages_list, expr_key, speaker_order, _, resulting_status, resulting_is_active in turn_message_rows:
        tm = TurnMessage(
            turn_id=turn_record.id,
            session_character_id=sc.id if sc is not None else None,
            speaker_type="narrator" if sc is None else "character",
            messages=messages_list,
            expression_key=expr_key,
            speaker_order=speaker_order,
        )
        # Transient (non-persisted) attributes — not mapped DB columns, just
        # carried on the Python instance so TurnMessageResponse.from_attributes
        # can pick them up below. See TurnMessageResponse docstring (TASK-009).
        tm.resulting_status = resulting_status
        tm.resulting_is_active = resulting_is_active
        db.add(tm)
        persisted_messages.append(tm)

    # ── Compress history every 10 turns (DB-only, no Redis) ──
    if session.turn_count % 10 == 0:
        from app.services.history_service import compress_if_needed
        await compress_if_needed(session, db)

    # G2 fix: current_choices used to be set by the caller (process_turn /
    # the streaming persistence path) in a SEPARATE commit right after this
    # function returned — meaning a turn could be durably committed while
    # current_choices briefly lagged behind if that second commit ever
    # failed. Setting it here, before the single commit below, makes the
    # turn record and the choices it presents land in the same transaction.
    session.current_choices = _extract_options(turn_result)

    await db.commit()
    await db.refresh(turn_record)
    for tm in persisted_messages:
        await db.refresh(tm)

    return turn_record, persisted_messages
