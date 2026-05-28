# Token budget configuration for lore_chunks retrieval (RAG context injection).
#
# Replaces the old row-count limits (LIMIT 3 / top_k=4) with an actual token
# budget. Row count is a poor proxy for prompt cost — a one-line context
# change and a 400-character scene description both used to count as "1 row,"
# which let Tier 1 silently balloon and starve Tier 2's fixed top_k pool.
#
# Sizing note (2026-06): total per-turn prompt averages ~1700-2500 tokens
# across system_prompt.txt + character_profiles + history_summary + last 8
# turns of dialogue history (see context_builder.py). Lore is sized as a
# supporting slice of that, not a competing budget — it should season the
# prompt, not crowd out live conversation or character context. Revisit
# these numbers once LORE_BUDGET logging (see lore_service.py) has real data.
import logging

logger = logging.getLogger(__name__)

# Total tokens lore_chunks may consume in a single turn's prompt, across
# both stages combined.
LORE_TOTAL_BUDGET_TOKENS: int = 350

# Tier 1 (priority >= 3, always-inject) ceiling. Deliberately small — this
# tier should normally hold one scene description line and at most one
# active context_change line, both short. If real data shows this is
# consistently maxed out, something upstream (e.g. demotion not firing) is
# almost certainly wrong; see the LORE_BUDGET warning for "tier1 capped".
TIER1_MAX_TOKENS: int = 120

# Tier 2 (priority < 3, semantic search) is never larger than this even if
# Tier 1 used zero tokens. Acts as an upper ceiling independent of the
# remainder calculation, mostly as a sanity backstop.
TIER2_MAX_TOKENS: int = 280

_ENCODING_NAME = "cl100k_base"
_encoder = None
_encoder_load_failed = False


def _get_encoder():
    """
    Lazily load the tiktoken encoder once per process. tiktoken downloads its
    BPE merge table from openaipublic.blob.core.windows.net on first use and
    caches it locally (set TIKTOKEN_CACHE_DIR to control where) — this means
    the *first* call in any environment needs outbound HTTPS to that host.
    If that's blocked (locked-down egress, air-gapped build, etc.) this
    fails once, logs it, and every call after permanently uses the fallback
    heuristic instead of retrying and failing repeatedly.
    """
    global _encoder, _encoder_load_failed
    if _encoder is not None or _encoder_load_failed:
        return _encoder
    try:
        import tiktoken
        _encoder = tiktoken.get_encoding(_ENCODING_NAME)
    except Exception as exc:
        _encoder_load_failed = True
        logger.warning(
            "tiktoken encoder unavailable (%s) — falling back to heuristic "
            "token estimation (len(text)//4) for lore budgeting. This is "
            "less accurate, especially for non-English text, but the app "
            "stays functional. If this persists in production, check "
            "outbound access to openaipublic.blob.core.windows.net or "
            "vendor the cl100k_base cache file at build time.",
            exc,
        )
    return _encoder


def estimate_tokens(text_value: str) -> int:
    """
    Estimate token count for a piece of text. Used only for lore budgeting —
    not for billing or provider-accurate accounting, so cl100k_base is a
    reasonable proxy even though dialogue/embedding calls don't use OpenAI
    models. Falls back to a coarse len//4 heuristic if tiktoken is
    unavailable (see _get_encoder).
    """
    if not text_value:
        return 0
    encoder = _get_encoder()
    if encoder is not None:
        return len(encoder.encode(text_value))
    # Fallback heuristic — intentionally coarse. Vietnamese/English mixed
    # content can run higher than this per character, so this is a
    # deliberately conservative (under-)estimate; the hard ceilings in
    # lore_service.py still apply on top of it as a backstop.
    return max(1, len(text_value) // 4)
