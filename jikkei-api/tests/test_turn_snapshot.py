from datetime import datetime, timezone
from uuid import uuid4

from app.models.scene import SceneSession, SessionCharacter
from app.services.turn_snapshot import capture_turn_state, restore_turn_state


def make_session() -> SceneSession:
    return SceneSession(
        id=uuid4(), scene_id=uuid4(), user_id=uuid4(), game_mode="normal",
        turn_count=3, is_active=True, is_resumable=True,
        current_background_id=uuid4(), world_events=["met"],
        history_summary="summary", active_context_change="at school",
        context_change_turns_remaining=2, outcome=None, outcome_message=None,
        current_choices=["A", "B"],
    )


def make_character(session_id) -> SessionCharacter:
    return SessionCharacter(
        id=uuid4(), session_id=session_id, source_character_id=uuid4(),
        name="Mika", description="test", position=0, is_active=True,
        is_session_only=False, status="active", current_expression_key="happy",
        attribute_values={"affection": 62},
    )


def test_turn_snapshot_restores_session_and_character_state():
    session = make_session()
    character = make_character(session.id)
    snapshot = capture_turn_state(session, [character])

    session.turn_count = 4
    session.is_active = False
    session.is_resumable = False
    session.current_background_id = uuid4()
    session.world_events = ["changed"]
    session.history_summary = "changed"
    session.active_context_change = None
    session.context_change_turns_remaining = 0
    session.outcome = "bad_end"
    session.outcome_message = "Ended"
    session.ended_at = datetime.now(timezone.utc)
    session.current_choices = []
    character.attribute_values = {"affection": 1}
    character.current_expression_key = "sad"
    character.status = "inactive"
    character.is_active = False

    restore_turn_state(snapshot, session, [character])

    assert session.turn_count == 3
    assert session.is_active is True
    assert session.is_resumable is True
    assert session.world_events == ["met"]
    assert session.history_summary == "summary"
    assert session.active_context_change == "at school"
    assert session.context_change_turns_remaining == 2
    assert session.outcome is None
    assert session.ended_at is None
    assert session.current_choices == ["A", "B"]
    assert character.attribute_values == {"affection": 62}
    assert character.current_expression_key == "happy"
    assert character.status == "active"
    assert character.is_active is True
