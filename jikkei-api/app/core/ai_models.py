# AI model registry for Jikkei.
#
# Single source of truth for every model ID used in the project.
# All services import from here — never hardcode a model string elsewhere.
#
# Provider split:
#   Google AI Studio → primary dialogue for every account tier
#   OpenRouter       → dialogue fallback and summarisation
#   OpenAI           → optional embedding fallback only
#
# Free and premium share one dialogue model chain. Tier only changes usage.
#
# Summarisation (RAG write side):
#   Meta Llama 3.1 8B Instruct via OpenRouter — cheap structured output.
#   Budget fallback: Google Gemma 2 9B IT via OpenRouter.

from enum import StrEnum


class OpenRouterModel(StrEnum):
    # Primary dialogue model. Best overall for VN/roleplay — strong character
    # voice, handles long context, natural dialogue tone.
    GEMINI_FLASH = "google/gemini-2.5-flash"

    # Cheaper Gemini fallback if the primary Flash route is unavailable.
    GEMINI_FLASH_LITE = "google/gemini-2.0-flash-lite-001"

    # Fast summarisation model for scene compression and history summaries.
    LLAMA_SUMMARY = "meta-llama/llama-3.3-70b-instruct:free"

    # Fallback summarisation model.
    QWEN_SUMMARY_FALLBACK = "qwen/qwen-2.5-7b-instruct:free"

    # Budget fallback if the primary dialogue model is unavailable.
    GEMMA_FALLBACK = "google/gemma-4-26b-a4b-it:free"


class EmbeddingModel(StrEnum):
    # Main embedding model — OpenRouter fallback only (direct NVIDIA API is primary).
    # Native 2048-dim, requested truncated to 768 (Matryoshka) to match the DB column.
    NEMOTRON_EMBED = "nvidia/llama-nemotron-embed-1b-v2:free"

    # Fallback embedding model — via OpenRouter.
    # Native 4096-dim, requested truncated to 768 (Matryoshka) to match the DB column.
    QWEN_EMBED_FALLBACK = "qwen/qwen3-embedding-8b"

    # Legacy fallback — OpenAI, only used if both OpenRouter embedding models fail
    # and OPENAI_API_KEY is configured. 1536-dim native, truncated to 768.
    OPENAI_SMALL = "text-embedding-3-small"


# ── Defaults ──────────────────────────────────────────────────────────────────

# Dialogue — SceneService, CharacterService.
DEFAULT_DIALOGUE_MODEL: str = OpenRouterModel.GEMINI_FLASH.value

# Summarisation — MemoryService on scene end.
DEFAULT_SUMMARISATION_MODEL: str = OpenRouterModel.LLAMA_SUMMARY.value
SUMMARISATION_FALLBACK_MODEL: str = OpenRouterModel.QWEN_SUMMARY_FALLBACK.value

# Budget fallback for dialogue and summary paths.
BUDGET_FALLBACK_MODEL: str = OpenRouterModel.GEMMA_FALLBACK.value

# Embedding — RAGService, both lore_store and memory_store.
DEFAULT_EMBEDDING_MODEL: str = EmbeddingModel.NEMOTRON_EMBED.value
EMBEDDING_FALLBACK_MODEL: str = EmbeddingModel.QWEN_EMBED_FALLBACK.value
EMBEDDING_DIM: int = 768

# Direct NVIDIA API model id (integrate.api.nvidia.com) — main embedding path.
# Note the model id differs slightly from the OpenRouter slug above (no ":free" suffix).
NVIDIA_DIRECT_EMBEDDING_MODEL: str = "nvidia/llama-nemotron-embed-1b-v2"


# ── Routing helpers ───────────────────────────────────────────────────────────

def dialogue_model_for_tier(tier: str) -> str:
    """Return the shared dialogue model; tiers only affect usage limits."""
    _ = tier
    return DEFAULT_DIALOGUE_MODEL


def dialogue_model_candidates_for_tier(tier: str) -> tuple[str, ...]:
    """Return the same fallback chain for every account tier."""
    _ = tier
    return DEFAULT_DIALOGUE_MODEL, OpenRouterModel.GEMINI_FLASH_LITE.value, BUDGET_FALLBACK_MODEL


def summarisation_model_candidates() -> tuple[str, ...]:
    """Return the preferred summary model plus its fallback."""
    return DEFAULT_SUMMARISATION_MODEL, SUMMARISATION_FALLBACK_MODEL, OpenRouterModel.GEMINI_FLASH_LITE.value, BUDGET_FALLBACK_MODEL


def embedding_model_candidates() -> tuple[str, ...]:
    """Return the preferred embedding model plus its fallback, both via OpenRouter."""
    return DEFAULT_EMBEDDING_MODEL, EMBEDDING_FALLBACK_MODEL
