"""Capture and restore the mutable runtime state surrounding an AI turn."""

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status

from app.models.scene import SceneSession, SessionCharacter


def capture_turn_state(
    session: SceneSession,
    session_characters: list[SessionCharacter],
) -> dict[str, Any]:
    return {
        "session": {
            "turn_count": int(session.turn_count or 0),
            "is_active": bool(session.is_active),
            "is_resumable": bool(session.is_resumable),
            "current_background_id": str(session.current_background_id) if session.current_background_id else None,
            "world_events": list(session.world_events or []),
            "history_summary": session.history_summary,
            "active_context_change": session.active_context_change,
            "context_change_turns_remaining": int(session.context_change_turns_remaining or 0),
            "outcome": session.outcome,
            "outcome_message": session.outcome_message,
            "ended_at": session.ended_at.isoformat() if session.ended_at else None,
            "current_choices": list(session.current_choices or []),
        },
        "characters": {
            str(character.id): {
                "attribute_values": dict(character.attribute_values or {}),
                "current_expression_key": character.current_expression_key,
                "status": character.status,
                "is_active": bool(character.is_active),
            }
            for character in session_characters
        },
    }


def restore_turn_state(
    snapshot: dict[str, Any] | None,
    session: SceneSession,
    session_characters: list[SessionCharacter],
) -> None:
    if not isinstance(snapshot, dict):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This turn predates rollback snapshots and cannot be redone safely",
        )

    session_state = snapshot.get("session")
    character_states = snapshot.get("characters")
    if not isinstance(session_state, dict) or not isinstance(character_states, dict):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The saved rollback snapshot is incomplete",
        )

    background_id = session_state.get("current_background_id")
    ended_at = session_state.get("ended_at")

    session.turn_count = int(session_state.get("turn_count", 0))
    session.is_active = bool(session_state.get("is_active", True))
    session.is_resumable = bool(session_state.get("is_resumable", True))
    session.current_background_id = UUID(background_id) if background_id else None
    session.world_events = list(session_state.get("world_events") or [])
    session.history_summary = session_state.get("history_summary")
    session.active_context_change = session_state.get("active_context_change")
    session.context_change_turns_remaining = int(session_state.get("context_change_turns_remaining", 0))
    session.outcome = session_state.get("outcome")
    session.outcome_message = session_state.get("outcome_message")
    session.ended_at = datetime.fromisoformat(ended_at) if ended_at else None
    session.current_choices = list(session_state.get("current_choices") or [])

    by_id = {str(character.id): character for character in session_characters}
    for character_id, raw_state in character_states.items():
        character = by_id.get(character_id)
        if character is None or not isinstance(raw_state, dict):
            continue
        character.attribute_values = dict(raw_state.get("attribute_values") or {})
        character.current_expression_key = raw_state.get("current_expression_key")
        character.status = str(raw_state.get("status") or "active")
        character.is_active = bool(raw_state.get("is_active", True))
