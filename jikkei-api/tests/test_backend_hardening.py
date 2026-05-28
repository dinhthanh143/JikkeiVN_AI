from types import SimpleNamespace
from uuid import uuid4

from app.core.ai_models import (
    DEFAULT_DIALOGUE_MODEL,
    dialogue_model_candidates_for_tier,
    dialogue_model_for_tier,
)
from app.services.ai_service import _openrouter_messages, _usage_cache_info
from app.services.context_builder import fill_dynamic_context, fill_stable_prompt


def test_account_tiers_share_the_same_dialogue_chain() -> None:
    assert dialogue_model_for_tier("free") == DEFAULT_DIALOGUE_MODEL
    assert dialogue_model_for_tier("premium") == DEFAULT_DIALOGUE_MODEL
    assert dialogue_model_candidates_for_tier("free") == dialogue_model_candidates_for_tier("premium")


def test_openrouter_cache_usage_supports_sdk_dict_details() -> None:
    usage = SimpleNamespace(
        prompt_tokens=10,
        prompt_tokens_details={"cached_tokens": 8, "cache_write_tokens": 0},
    )
    assert _usage_cache_info(usage) == (8, 10)


def test_openrouter_marks_only_the_stable_system_block_cacheable() -> None:
    messages = _openrouter_messages("stable", [{"role": "user", "content": "volatile"}])
    system_part = messages[0]["content"][0]
    assert system_part["text"] == "stable"
    assert system_part["cache_control"] == {"type": "ephemeral"}
    assert messages[1]["content"] == "volatile"


def test_dynamic_context_contains_current_input_once() -> None:
    context = fill_dynamic_context(
        session_chars=[],
        lore_chunks=[],
        history_summary=None,
        current_background_name=None,
        input_type="prompt",
        player_input="UNIQUE_PLAYER_INPUT",
        context_change="UNIQUE_CONTEXT_CHANGE",
        world_events=[],
    )
    assert context.count("UNIQUE_PLAYER_INPUT") == 1
    assert context.count("UNIQUE_CONTEXT_CHANGE") == 1


def test_typical_stable_prompt_keeps_cache_eligibility_headroom() -> None:
    scene = SimpleNamespace(
        description="A rain-soaked city where every promise has a price.",
        game_mode="normal",
    )
    character = SimpleNamespace(
        id=uuid4(),
        name="Mina",
        description="A guarded detective who speaks precisely and distrusts easy answers.",
        position=0,
        is_active=True,
    )
    prompt = fill_stable_prompt(
        scene=scene,
        session_chars=[character],
        valid_expressions_by_char={str(character.id): ["neutral", "angry", "soft"]},
        valid_backgrounds=["Alley", "Office"],
    )
    # Deterministic heuristic regression guard. Gemini's countTokens endpoint
    # remains the authority for the exact provider-side token count.
    assert len(prompt) // 4 >= 2048
