# Lore retrieval-augmented generation (RAG) service for scene memory.
import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlalchemy import delete, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_models import embedding_model_candidates, EMBEDDING_DIM, NVIDIA_DIRECT_EMBEDDING_MODEL
from app.core.config import settings
from app.core.lore_budget import (
    LORE_TOTAL_BUDGET_TOKENS,
    TIER1_MAX_TOKENS,
    TIER2_MAX_TOKENS,
    estimate_tokens,
)
from app.core.lore_consolidation import (
    CONSOLIDATION_SYSTEM_PROMPT,
    EVENT_CHUNK_CONSOLIDATION_BATCH_SIZE,
    EVENT_CHUNK_CONSOLIDATION_MAX_OUTPUT,
    EVENT_CHUNK_CONSOLIDATION_THRESHOLD,
)
from app.core.lore_dedup import DEDUP_SIMILARITY_THRESHOLD
from app.models.scene import LoreChunk, Scene, SceneSession

logger = logging.getLogger(__name__)

# Embedding dimension is centrally defined in ai_models.py (EMBEDDING_DIM = 768)
# and must match the lore_chunks.embedding column (vector(768)).
_EMBEDDING_DIM = EMBEDDING_DIM


async def _embed_via_nvidia_direct(text_value: str, input_type: str) -> list[float]:
    """
    Direct NVIDIA API call (integrate.api.nvidia.com) — bypasses OpenRouter
    entirely for max rate limits. Matches the working curl exactly.

    input_type is NOT optional metadata — NVIDIA's NV-Embed-style models are
    asymmetric bi-encoders. "query" and "passage" embeddings are trained to
    land close together in vector space ONLY when each side is tagged
    correctly. Mixing them up doesn't error, it silently tanks retrieval
    accuracy. Callers must go through embed_passage()/embed_query() below,
    never call this directly with a guessed input_type.
    """
    if input_type not in ("query", "passage"):
        raise ValueError(f"input_type must be 'query' or 'passage', got {input_type!r}")

    api_key = settings.NVIDIA_API_KEY
    if not api_key:
        raise ValueError("NVIDIA_API_KEY not configured")

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://integrate.api.nvidia.com/v1/embeddings",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": NVIDIA_DIRECT_EMBEDDING_MODEL,
                "input": [text_value],
                "input_type": input_type,
                "encoding_format": "float",
                "truncate": "NONE",
            },
        )
        response.raise_for_status()
        data = response.json()
        vector = [float(v) for v in data["data"][0]["embedding"]]

    # Native output is 2048-dim (non-VL nemotron-embed-1b-v2) — the direct API
    # has no `dimensions` truncation param, so we truncate/pad client-side to
    # match the DB column exactly, same safety net as the OpenRouter path.
    if len(vector) > _EMBEDDING_DIM:
        vector = vector[:_EMBEDDING_DIM]
    elif len(vector) < _EMBEDDING_DIM:
        vector = vector + [0.0] * (_EMBEDDING_DIM - len(vector))
    return vector


async def _embed_via_openrouter(text_value: str, model: str) -> list[float]:
    """
    Embed via OpenRouter using the given model id. Requests truncated to
    _EMBEDDING_DIM (768) via the `dimensions` param (Matryoshka truncation) so
    the output always matches the lore_chunks.embedding column regardless of
    the model's native dimension (Nemotron=2048, Qwen3-8B=4096).

    Some OpenRouter-hosted providers reject the `dimensions` param outright
    (seen with vLLM-backed Qwen3 deployments) — if that happens we retry once
    without it and truncate the returned vector client-side instead.
    """
    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not configured")

    async def _request(with_dimensions: bool) -> list[float]:
        payload: dict = {"model": model, "input": text_value}
        if with_dimensions:
            payload["dimensions"] = _EMBEDDING_DIM
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return [float(v) for v in data["data"][0]["embedding"]]

    try:
        vector = await _request(with_dimensions=True)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 400:
            logger.warning("OpenRouter model %s rejected dimensions param, retrying without it", model)
            vector = await _request(with_dimensions=False)
        else:
            raise

    if len(vector) > _EMBEDDING_DIM:
        vector = vector[:_EMBEDDING_DIM]
    elif len(vector) < _EMBEDDING_DIM:
        vector = vector + [0.0] * (_EMBEDDING_DIM - len(vector))
    return vector

# ── Embedding clients ─────────────────────────────────────────────────────────

async def _embed_text_internal(text_value: str, input_type: str) -> list[float]:
    """
    Embed a single string with automatic provider fallback.

    Priority:
      1. Direct NVIDIA API (main) — correct input_type applied
      2. OpenRouter (fallback only) — no input_type concept there, accepted
         tradeoff since this path only fires if NVIDIA direct is down
      3. Zero vector (RAG disabled, app still works)
    """
    normalized = text_value.strip()
    if not normalized:
        return [0.0] * _EMBEDDING_DIM

    # Warn if truncation is happening instead of doing it silently mid-word
    if len(normalized) > 8000:
        logger.warning(
            "Input text length (%d) exceeds 8000 characters. "
            "Truncating context, which may cut off semantic meaning mid-sentence.",
            len(normalized)
        )
        normalized = normalized[:8000]

    # ── 1. Google AI Studio (primary, free) ────────────────────────────────────
    if settings.NVIDIA_API_KEY:
        try:
            return await _embed_via_nvidia_direct(normalized, input_type)
        except Exception as exc:
            logger.warning("Direct NVIDIA embedding (%s) failed, falling back to OpenRouter: %s", input_type, exc)

    if settings.OPENROUTER_API_KEY:
        for model in embedding_model_candidates():
            try:
                return await _embed_via_openrouter(normalized, model)
            except Exception as exc:
                logger.warning("OpenRouter embedding via %s failed: %s", model, exc)



    # ── 2. OpenAI (fallback, truncated to 768) ─────────────────────────────
    # ── 3. Zero vector — semantic search disabled ────────────────────────────
    logger.error(
        "No embedding provider available (set NVIDIA_API_KEY or OPENROUTER_API_KEY). "
        "Returning zero vector — semantic RAG will not work."
    )
    return [0.0] * _EMBEDDING_DIM


async def embed_passage(text_value: str) -> list[float]:
    """
    Embed text being WRITTEN/INDEXED into lore_chunks — scene descriptions,
    extracted facts, context changes, manually authored lore. Use this for
    every embedding that gets stored into the embedding column.
    """
    return await _embed_text_internal(text_value, "passage")


async def embed_query(text_value: str) -> list[float]:
    """
    Embed text being SEARCHED WITH — the live player input / lore_query used
    in search_relevant_lore's Stage 2 vector search. Use this for the query
    side of every similarity search, never for content being stored.
    """
    return await _embed_text_internal(text_value, "query")


async def embed_text(text_value: str) -> list[float]:
    """
    Back-compat alias — defaults to passage mode. Existing call sites that
    write lore (embed_scene_setup, store_event_as_lore, etc.) are correct
    as-is since writing IS passage mode. search_relevant_lore's query-side
    call has been migrated to embed_query() directly — see below.
    """
    return await embed_passage(text_value)


def _append_chunk(
    chunks: list[dict],
    content: str | None,
    chunk_type: str,
    priority: int,
    scene_id: UUID | None = None,
    character_id: UUID | None = None,
) -> None:
    if not content:
        return
    normalized = content.strip()
    if not normalized:
        return
    chunks.append({
        "scene_id": scene_id,
        "character_id": character_id,
        "content": normalized,
        "chunk_type": chunk_type,
        "priority": priority,
    })


async def embed_scene_setup(scene_id: UUID, db: AsyncSession) -> None:
    """
    Called as a background task after scene creation/update.
    Embeds the scene description into lore_chunks.

    NOTE on character chunks: we deliberately do NOT create lore chunks for
    character name/description here. That data is already injected into every
    turn's system prompt via {character_profiles} (see context_builder.py
    _build_character_profiles). Storing it again as priority-1 lore would be
    pure duplication — it would sit in the Stage 2 hybrid-search pool competing
    for retrieval slots against actual episodic/event lore, for content the
    model already has unconditionally. We only store DERIVED character lore
    here (e.g. world/rule context), never their base identity.

    Priority levels:
      3 = always inject (scene description)
      1 = semantic match only (episodic events, written elsewhere)
    """
    scene_result = await db.execute(select(Scene).where(Scene.id == scene_id))
    scene = scene_result.scalar_one_or_none()
    if scene is None:
        return

    chunks: list[dict] = []

    # Scene-level lore — description only (fail_condition removed)
    _append_chunk(chunks, scene.description, "world", 3, scene_id=scene_id)

    # Replace setup chunks only — preserve runtime lore (events, context_changes, session memory)
    await db.execute(
        delete(LoreChunk).where(
            LoreChunk.scene_id == scene_id,
            LoreChunk.chunk_type.in_(["world", "character", "rule"]),
        )
    )

    # Batch embed in groups of 10
    for i in range(0, len(chunks), 10):
        batch = chunks[i:i + 10]
        embeddings = await asyncio.gather(*(embed_text(c["content"]) for c in batch))
        for chunk, embedding in zip(batch, embeddings):
            db.add(LoreChunk(
                scene_id=chunk["scene_id"],
                character_id=chunk["character_id"],
                content=chunk["content"],
                chunk_type=chunk["chunk_type"],
                priority=chunk["priority"],
                embedding=embedding,
                created_at=datetime.now(timezone.utc),
            ))

    await db.flush()

    # Populate ts_content (keyword search vector) for the chunks we just inserted.
    # Done as a follow-up UPDATE since to_tsvector() runs server-side.
    await db.execute(
        text(
            """
            UPDATE lore_chunks
            SET ts_content = to_tsvector('english', content)
            WHERE scene_id = CAST(:scene_id AS uuid)
              AND chunk_type IN ('world', 'character', 'rule')
              AND ts_content IS NULL
            """
        ),
        {"scene_id": str(scene_id)},
    )

    await db.commit()


async def embed_session_character_setup(
    session_id: UUID,
    session_character_id: UUID,
    description: str | None,
    db: AsyncSession,
) -> None:
    """
    Personalized-mode equivalent of embed_scene_setup, scoped to ONE session
    character instead of the whole scene. Called whenever a Personalized
    story edit creates or updates a SessionCharacter (see
    create_session_character / update_session_character in routers/scene.py).

    Unlike template characters (whose name/description is injected directly
    into the stable system prompt via context_builder._build_character_identity_block
    and deliberately NOT chunked, per embed_scene_setup's docstring), this
    DOES chunk the description — a product decision to give personalized
    characters richer RAG retrieval on top of the prompt injection they
    already get (identity_chars in context_builder.py includes ALL active
    session characters, personalized or not, so this chunk is additive, not
    a replacement mechanism).

    Sets BOTH session_id and session_character_id on the chunk (not just
    session_character_id alone) — search_relevant_lore's Stage 1/2 queries
    filter on session_id only, with no session_character_id-specific
    filtering logic. Setting both is what makes this chunk actually
    retrievable through the existing retrieval path without any SQL changes
    there; session_character_id is carried for provenance/scoping (e.g. so a
    character-removal cleanup can target exactly this character's chunks)
    rather than as the sole join key for retrieval.

    Priority 3 (always inject) — matches embed_scene_setup's scene-description
    chunk, since a personalized character's description is exactly as
    foundational to play as the scene description is.

    Replace semantics: deletes this character's existing 'character'-type
    chunks before inserting the new one, same replace-not-accumulate pattern
    as embed_scene_setup (an edit updates the description, it doesn't pile on
    a second copy).

    Does NOT commit — caller owns the transaction (the route handler that
    calls this should commit once, alongside the SessionCharacter row itself).
    """
    await db.execute(
        delete(LoreChunk).where(
            LoreChunk.session_character_id == session_character_id,
            LoreChunk.chunk_type == "character",
        )
    )

    content = (description or "").strip()
    if not content:
        await db.flush()
        return

    embedding = await embed_text(content)
    chunk = LoreChunk(
        session_id=session_id,
        session_character_id=session_character_id,
        content=content,
        chunk_type="character",
        priority=3,
        embedding=embedding,
        created_at=datetime.now(timezone.utc),
    )
    db.add(chunk)
    await db.flush()
    await db.execute(
        text("UPDATE lore_chunks SET ts_content = to_tsvector('english', content) WHERE id = :id"),
        {"id": str(chunk.id)},
    )


async def delete_session_character_chunks(session_character_id: UUID, db: AsyncSession) -> None:
    """
    Hard-deletes every lore_chunks row scoped to this session_character_id,
    regardless of chunk_type. Called when a personalized character is removed
    (see delete_session_character in routers/scene.py) — per explicit product
    decision, removal hard-deletes immediately rather than soft-deactivating
    and letting chunks age out, matching how removing a character is already
    a hard, immediate action elsewhere in this app (e.g. original-mode
    character deletion). Does NOT commit — caller owns the transaction.
    """
    await db.execute(delete(LoreChunk).where(LoreChunk.session_character_id == session_character_id))


async def search_relevant_lore(
    query: str,
    scene_id: UUID,
    top_k: int = 4,
    similarity_threshold: float = 0.70,
    *,
    session_id: UUID | None = None,
    character_ids: list[UUID] | None = None,
    session_char_ids: list[UUID] | None = None,
    current_turn_number: int | None = None,
    excluded_turn_number: int | None = None,
    decay_half_life_turns: float = 20.0,
    db: AsyncSession,
) -> list[str]:
    """
    Two-stage retrieval, TOKEN-budgeted (not row-count budgeted):

    Stage 1 — always inject (priority >= 3), capped at TIER1_MAX_TOKENS:
      WHERE session_id = :session_id AND priority >= 3
      Picks up: scene description (always 1 row) + the single active
      context_change chunk, if any (0 or 1 row, enforced by ai_service.py
      demoting the previous chunk to priority 2 whenever a new one arrives
      or the 3-turn boost window expires). The token cap — not a row LIMIT —
      is the real safety net here: row count was a poor proxy for prompt
      cost since a one-line context change and a long scene description
      both counted as "1 row." If TIER1_MAX_TOKENS is consistently maxed
      out in practice, that's a signal the demote-on-replace/expire
      invariant in ai_service.py isn't firing — see LORE_BUDGET_LOG warning.

    Stage 2 — hybrid search (vector + keyword via RRF) with time decay,
      budget = whatever Tier 1 didn't use, up to TIER2_MAX_TOKENS:
      WHERE session_id = :session_id AND priority < 3
      Picks up: episodic events, demoted context_change facts, per-character
      session memory. RRF score is multiplied by an exponential decay factor
      based on chunk age (current_turn_number - chunk.turn_number), so recent
      facts outrank ancient ones of equal relevance — but nothing is ever
      excluded outright; a highly-relevant old fact can still surface.
      top_k is now a row-count CEILING only, not the primary control —
      token budget runs out first in almost every real case.
    """
    safe_top_k = max(1, top_k)
    session_id_pg = str(session_id) if session_id else None

    # ── Stage 1: always-inject chunks — token-budgeted, doesn't compete with Stage 2 ──
    # No row LIMIT here: we fetch all priority>=3 rows (there are normally only
    # 1-2 given the demotion invariant) and greedily accumulate by token count
    # in Python, since SQL can't easily do a running-token-sum cutoff.
    always_result = await db.execute(
        text(
            """
            SELECT content
            FROM lore_chunks
            WHERE session_id = CAST(:session_id AS uuid)
            AND priority >= 3
            AND (
              CAST(:excluded_turn_number AS integer) IS NULL
              OR turn_number IS DISTINCT FROM CAST(:excluded_turn_number AS integer)
            )
            ORDER BY priority DESC, created_at DESC
            """
        ),
        {
            "session_id": session_id_pg,
            "excluded_turn_number": excluded_turn_number,
        },
    )
    selected: list[str] = []
    tier1_tokens_used = 0
    tier1_rows_seen = 0
    tier1_rows_dropped = 0
    for row in always_result.fetchall():
        content = row[0]
        if not content or content in selected:
            continue
        tier1_rows_seen += 1
        content_tokens = estimate_tokens(content)
        # Always admit at least the first Tier 1 chunk even if it alone
        # exceeds the cap — never zero out always-inject content entirely.
        if selected and tier1_tokens_used + content_tokens > TIER1_MAX_TOKENS:
            tier1_rows_dropped += 1
            continue
        selected.append(content)
        tier1_tokens_used += content_tokens

    if tier1_rows_dropped > 0:
        logger.warning(
            "LORE_BUDGET: Tier 1 capped for session=%s — %d of %d always-inject "
            "chunks dropped (tier1_tokens_used=%d, cap=%d). This usually means "
            "more than one priority>=3 context_change row exists; check the "
            "demote-on-replace/expire logic in ai_service.py.",
            session_id_pg, tier1_rows_dropped, tier1_rows_seen, tier1_tokens_used, TIER1_MAX_TOKENS,
        )

    if not query.strip():
        logger.info(
            "LORE_BUDGET session=%s turn=%s tier1_tokens=%d tier2_tokens=0 "
            "tier1_chunks=%d tier2_chunks=0 (no query, stage 2 skipped)",
            session_id_pg, current_turn_number, tier1_tokens_used, len(selected),
        )
        return selected

    # Stage 2 gets whatever Tier 1 left over, capped independently at
    # TIER2_MAX_TOKENS so a near-empty Tier 1 can't let Stage 2 balloon
    # past its own sane ceiling either.
    stage2_budget_tokens = max(0, min(TIER2_MAX_TOKENS, LORE_TOTAL_BUDGET_TOKENS - tier1_tokens_used))

    # ── Stage 2: hybrid search (vector + keyword) via Reciprocal Rank Fusion + time decay ──
    # Independent budget of safe_top_k — NOT reduced by how many Stage 1 chunks were found.
    # Vector search catches semantic/vibe matches; keyword (BM25-style ts_rank) catches
    # exact proper nouns (item names, character names, spells) that embeddings can miss.
    # RRF blends both rankings: score = 1/(k + rank_vector) + 1/(k + rank_keyword)
    # Time decay then multiplies that score by 0.5^(age / half_life) — a fact half
    # the decay_half_life_turns old retains ~50% weight, fading further with age,
    # but never hits zero so it can still surface if it's a strong hybrid match.
    # Chunks with turn_number IS NULL (e.g. snapshot copies of template lore) are
    # treated as age 0 — no decay penalty, since they aren't episodic/time-bound.
    query_text = query.strip()
    query_embedding = await embed_query(query_text)
    query_embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"
    rrf_k = 60  # standard RRF damping constant
    ref_turn = current_turn_number if current_turn_number is not None else 0
    half_life = max(1.0, decay_half_life_turns)

    hybrid_result = await db.execute(
        text(
            """
            WITH vector_ranked AS (
                SELECT id, content, turn_number,
                       ROW_NUMBER() OVER (ORDER BY embedding <=> CAST(:query_embedding AS vector)) AS rnk
                FROM lore_chunks
                WHERE session_id = CAST(:session_id AS uuid)
                  AND priority < 3
                  AND (
                    CAST(:excluded_turn_number AS integer) IS NULL
                    OR turn_number IS DISTINCT FROM CAST(:excluded_turn_number AS integer)
                  )
                  AND embedding IS NOT NULL
                  AND (1 - (embedding <=> CAST(:query_embedding AS vector))) >= :similarity_threshold
                ORDER BY embedding <=> CAST(:query_embedding AS vector)
                LIMIT 20
            ),
            keyword_ranked AS (
                SELECT id, content, turn_number,
                       ROW_NUMBER() OVER (ORDER BY ts_rank(ts_content, plainto_tsquery('english', :query_text)) DESC) AS rnk
                FROM lore_chunks
                WHERE session_id = CAST(:session_id AS uuid)
                  AND priority < 3
                  AND (
                    CAST(:excluded_turn_number AS integer) IS NULL
                    OR turn_number IS DISTINCT FROM CAST(:excluded_turn_number AS integer)
                  )
                  AND ts_content IS NOT NULL
                  AND ts_content @@ plainto_tsquery('english', :query_text)
                ORDER BY ts_rank(ts_content, plainto_tsquery('english', :query_text)) DESC
                LIMIT 20
            ),
            fused AS (
                SELECT
                    COALESCE(v.id, k.id)                       AS id,
                    COALESCE(v.content, k.content)             AS content,
                    COALESCE(v.turn_number, k.turn_number)     AS turn_number,
                    COALESCE(1.0 / (:rrf_k + v.rnk), 0.0)
                  + COALESCE(1.0 / (:rrf_k + k.rnk), 0.0)        AS rrf_score
                FROM vector_ranked v
                FULL OUTER JOIN keyword_ranked k ON v.id = k.id
            ),
            decayed AS (
                SELECT
                    content,
                    rrf_score
                    * POWER(0.5, GREATEST(0, :ref_turn - COALESCE(turn_number, :ref_turn))::float / :half_life)
                    AS final_score
                FROM fused
            )
            SELECT content
            FROM decayed
            ORDER BY final_score DESC
            LIMIT :remaining
            """
        ),
        {
            "session_id":           session_id_pg,
            "query_embedding":      query_embedding_str,
            "query_text":           query_text,
            "similarity_threshold": similarity_threshold,
            "rrf_k":                rrf_k,
            "ref_turn":             ref_turn,
            "half_life":            half_life,
            "remaining":            safe_top_k,
            "excluded_turn_number": excluded_turn_number,
        },
    )
    stage2_added = 0
    stage2_tokens_used = 0
    for row in hybrid_result.fetchall():
        content = row[0]
        if not content or content in selected:
            continue
        content_tokens = estimate_tokens(content)
        # Always admit at least one Stage 2 chunk if the budget allows any
        # content at all, but never push past the per-stage ceiling.
        if stage2_added > 0 and stage2_tokens_used + content_tokens > stage2_budget_tokens:
            break
        selected.append(content)
        stage2_tokens_used += content_tokens
        stage2_added += 1
        if stage2_added >= safe_top_k:
            break

    logger.info(
        "LORE_BUDGET session=%s turn=%s tier1_tokens=%d tier2_tokens=%d "
        "tier1_chunks=%d tier2_chunks=%d budget_total=%d",
        session_id_pg, current_turn_number, tier1_tokens_used, stage2_tokens_used,
        len(selected) - stage2_added, stage2_added, LORE_TOTAL_BUDGET_TOKENS,
    )

    return selected


async def snapshot_lore_to_session(scene_id: UUID, session_id: UUID, db: AsyncSession) -> None:
    """
    Called at session start. Copies all template lore chunks (scene_id-scoped world/character/rule)
    into session-scoped rows so each player gets an isolated snapshot of the story at play-time.

    - scene_id / character_id are nulled on the copies — the session owns them entirely.
    - Embeddings AND ts_content (keyword search vector) are reused directly; no re-embedding
      or re-tokenizing cost.
    - If the creator later edits the scene, active sessions are unaffected.
      Only a reset/replay picks up the new version.
    """
    result = await db.execute(
        select(LoreChunk).where(
            LoreChunk.scene_id == scene_id,
            LoreChunk.chunk_type.in_(["world", "character", "rule"]),
            LoreChunk.session_id.is_(None),
        )
    )
    template_chunks = list(result.scalars().all())
    for chunk in template_chunks:
        db.add(LoreChunk(
            session_id=session_id,
            scene_id=None,
            character_id=None,
            session_character_id=None,
            content=chunk.content,
            chunk_type=chunk.chunk_type,
            priority=chunk.priority,
            embedding=chunk.embedding,
            ts_content=chunk.ts_content,
            created_at=datetime.now(timezone.utc),
        ))
    await db.flush()


async def _find_duplicate_chunk_id(
    session_id: UUID,
    chunk_type: str,
    candidate_embedding: list[float],
    db: AsyncSession,
    *,
    threshold: float = DEDUP_SIMILARITY_THRESHOLD,
) -> UUID | None:
    """
    Returns the id of the most similar existing chunk of the same chunk_type
    in this session, if its cosine similarity to candidate_embedding meets or
    exceeds `threshold`. Returns None if no chunk is similar enough (or none
    exist yet).

    This is a much stricter check than retrieval's similarity_threshold
    (currently 0.70 in search_relevant_lore) — retrieval asks "is this
    related enough to be useful context", dedup asks "is this close enough
    to be the literal same fact restated". A false-positive dedup (silently
    dropping a genuinely new but similar-sounding fact) is worse than an
    occasional near-duplicate slipping through, so the default threshold
    (DEDUP_SIMILARITY_THRESHOLD) is set high on purpose.
    """
    embedding_str = "[" + ",".join(str(v) for v in candidate_embedding) + "]"
    result = await db.execute(
        text(
            """
            SELECT id, 1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
            FROM lore_chunks
            WHERE session_id = CAST(:session_id AS uuid)
              AND chunk_type = :chunk_type
              AND embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:embedding AS vector)
            LIMIT 1
            """
        ),
        {"session_id": str(session_id), "chunk_type": chunk_type, "embedding": embedding_str},
    )
    row = result.first()
    if row is None:
        return None
    chunk_id, similarity = row
    if similarity is not None and similarity >= threshold:
        return chunk_id
    return None


async def store_event_as_lore(
    session_id: UUID,
    event_text: str,
    db: AsyncSession,
    turn_number: int | None = None,
    *,
    commit: bool = False,
) -> None:
    """
    Store a significant scene event as session-scoped episodic lore. Priority 1
    (semantic match only).

    Deduplication: before inserting, checks for an existing 'event' chunk in
    this session whose embedding is near-identical (see
    DEDUP_SIMILARITY_THRESHOLD / _find_duplicate_chunk_id). If one is found,
    the insert is skipped entirely — fact extraction can resurface the same
    narratively-salient fact across multiple compression windows (e.g. a
    secret revealed at turn 20 might still be the most relevant thing to
    extract at turn 30), and without this guard each resurfacing becomes a
    new chunk competing for the same Stage 2 retrieval slots.

    commit=False (default): flushes only — caller owns the transaction. This is
    the correct mode for every call inside apply_turn_result / compress_if_needed,
    so the lore write commits atomically together with the turn it belongs to
    (or rolls back together with it, instead of persisting independently if the
    parent transaction later fails).

    commit=True: also commits. Use ONLY when this is called on a standalone
    AsyncSession with no surrounding transaction to join — e.g. a fire-and-forget
    background task that opens its own session and has nothing else to commit.
    """
    content = event_text.strip()
    if not content:
        return
    embedding = await embed_text(content)

    duplicate_id = await _find_duplicate_chunk_id(session_id, "event", embedding, db)
    if duplicate_id is not None:
        logger.info(
            "LORE_DEDUP: skipped near-duplicate event chunk for session=%s "
            "(matches existing chunk=%s)", str(session_id), duplicate_id,
        )
        if commit:
            await db.commit()
        return

    chunk = LoreChunk(
        session_id=session_id,
        content=content,
        chunk_type="event",
        priority=1,
        embedding=embedding,
        turn_number=turn_number,
        created_at=datetime.now(timezone.utc),
    )
    db.add(chunk)
    await db.flush()
    await db.execute(
        text("UPDATE lore_chunks SET ts_content = to_tsvector('english', content) WHERE id = :id"),
        {"id": str(chunk.id)},
    )
    if commit:
        await db.commit()


async def consolidate_event_chunks_if_needed(session_id: UUID, db: AsyncSession) -> None:
    """
    Chunk-lifecycle consolidation for session-scoped 'event' lore (priority 1).

    Unlike history_service.compress_if_needed (which produces a lossy prose
    summary), this is a LOSSLESS merge: episodic event chunks must stay
    retrievable as discrete facts for Stage 2 hybrid search, so consolidation
    combines redundant/overlapping facts into fewer chunks rather than
    condensing them into a short paragraph. See lore_consolidation.py for the
    full reasoning on the count-based trigger and threshold choices.

    Trigger: fires when the session's 'event' chunk count exceeds
    EVENT_CHUNK_CONSOLIDATION_THRESHOLD. Pulls the oldest
    EVENT_CHUNK_CONSOLIDATION_BATCH_SIZE chunks (by turn_number, nulls first —
    treated as oldest since they predate episodic tracking), sends them to a
    cheap summarisation-tier LLM for a lossless merge, deletes the originals,
    and inserts the merged set as new chunks.

    turn_number handling: each merged output chunk is stamped with the NEWEST
    turn_number among the consolidated batch, not the oldest and not None.
    This matters for search_relevant_lore's time-decay scoring — stamping the
    oldest turn would make a freshly-merged chunk decay as if it were still
    ancient, even though consolidation just touched it; the newest-in-batch
    turn is the more honest "this information was last confirmed relevant at
    turn N" signal.

    Deletion: source chunks are hard-deleted, not soft-archived. They're fully
    represented by the merged output (lossless merge), so keeping them around
    serves no retrieval purpose and only grows the table.

    Does NOT commit — caller owns the transaction, same convention as
    compress_if_needed. Call this from the same place compress_if_needed is
    called (inside apply_turn_result), gated by its own count check below —
    consolidation should run far less often than the 10-turn summary cadence.

    Scope: only chunk_type='event' is ever touched here. context_change has
    its own demote-not-delete lifecycle (see ai_service.py); world/character/
    rule chunks are template-replace, not accumulating (see embed_scene_setup).
    Neither needs or should get this treatment.

    Failure handling: wrapped in its own try/except, mirroring the
    fact-extraction block in compress_if_needed — a consolidation failure
    must never break the turn it's piggybacking on. On failure, the session
    simply keeps accumulating event chunks and retries consolidation next turn.
    """
    try:
        count_result = await db.execute(
            text(
                """
                SELECT COUNT(*) FROM lore_chunks
                WHERE session_id = CAST(:session_id AS uuid) AND chunk_type = 'event'
                """
            ),
            {"session_id": str(session_id)},
        )
        event_chunk_count = count_result.scalar_one()
        if event_chunk_count <= EVENT_CHUNK_CONSOLIDATION_THRESHOLD:
            return

        batch_result = await db.execute(
            text(
                """
                SELECT id, content, turn_number FROM lore_chunks
                WHERE session_id = CAST(:session_id AS uuid) AND chunk_type = 'event'
                ORDER BY turn_number ASC NULLS FIRST, created_at ASC
                LIMIT :batch_size
                """
            ),
            {"session_id": str(session_id), "batch_size": EVENT_CHUNK_CONSOLIDATION_BATCH_SIZE},
        )
        batch_rows = batch_result.fetchall()
        if not batch_rows:
            return

        source_ids = [row[0] for row in batch_rows]
        source_facts = [row[1] for row in batch_rows if row[1]]
        # Newest turn_number in the batch — see docstring on why merged output
        # is stamped with this rather than the oldest or None.
        newest_turn_number = max((row[2] for row in batch_rows if row[2] is not None), default=None)

        if not source_facts:
            return

        # Late import — avoids circular dependency, same pattern as
        # history_service.compress_if_needed's calls into ai_service.
        from app.services.ai_service import call_openrouter_json
        from app.core.ai_models import summarisation_model_candidates

        numbered_facts = "\n".join(f"{i + 1}. {fact}" for i, fact in enumerate(source_facts))
        merged_facts: list[str] = []
        try:
            response = await call_openrouter_json(
                system_prompt=CONSOLIDATION_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": numbered_facts}],
                model_candidates=summarisation_model_candidates(),
                max_tokens=600,
            )
            payload = response.get("data", {}) if isinstance(response, dict) else {}
            if isinstance(payload, dict):
                raw_merged = payload.get("merged_facts")
                if isinstance(raw_merged, list):
                    merged_facts = [str(f).strip() for f in raw_merged if f and str(f).strip()]
        except Exception:
            logger.exception(
                "LORE_CONSOLIDATION: merge LLM call failed for session=%s — "
                "skipping this pass, will retry next turn", str(session_id),
            )
            return

        if not merged_facts:
            logger.warning(
                "LORE_CONSOLIDATION: merge returned no facts for session=%s — "
                "skipping rather than deleting sources with nothing to replace them",
                str(session_id),
            )
            return

        merged_facts = merged_facts[:EVENT_CHUNK_CONSOLIDATION_MAX_OUTPUT]

        # Delete sources only after we have a non-empty merged result in hand —
        # never delete-then-discover-the-merge-failed.
        await db.execute(delete(LoreChunk).where(LoreChunk.id.in_(source_ids)))

        for fact in merged_facts:
            embedding = await embed_text(fact)
            new_chunk = LoreChunk(
                session_id=session_id,
                content=fact,
                chunk_type="event",
                priority=1,
                embedding=embedding,
                turn_number=newest_turn_number,
                created_at=datetime.now(timezone.utc),
            )
            db.add(new_chunk)
            await db.flush()
            await db.execute(
                text("UPDATE lore_chunks SET ts_content = to_tsvector('english', content) WHERE id = :id"),
                {"id": str(new_chunk.id)},
            )

        logger.info(
            "LORE_CONSOLIDATION: session=%s merged %d source chunks into %d chunks "
            "(threshold=%d, batch_size=%d)",
            str(session_id), len(source_ids), len(merged_facts),
            EVENT_CHUNK_CONSOLIDATION_THRESHOLD, EVENT_CHUNK_CONSOLIDATION_BATCH_SIZE,
        )

    except Exception:
        logger.exception(
            "LORE_CONSOLIDATION: unexpected failure for session=%s — skipping, "
            "turn proceeds unaffected", str(session_id),
        )


async def store_context_change_as_lore(
    session_id: UUID,
    context_text: str,
    db: AsyncSession,
    turn_number: int | None = None,
    *,
    commit: bool = False,
) -> None:
    """
    Store a context change as session-scoped high-priority lore (priority 4 —
    always inject).

    Deduplication: same guard as store_event_as_lore, scoped to chunk_type
    'context_change'. Lower risk here in practice (only one context_change can
    be boosted at a time per the demote-on-replace invariant in
    ai_service.py), but the check is cheap and keeps the demoted/historical
    pool of context_change chunks from accumulating literal repeats either.

    commit semantics match store_event_as_lore above — default False so the
    write joins the caller's transaction (apply_turn_result or the standalone
    context-change route).
    """
    content = context_text.strip()
    if not content:
        return
    embedding = await embed_text(content)

    duplicate_id = await _find_duplicate_chunk_id(session_id, "context_change", embedding, db)
    if duplicate_id is not None:
        duplicate = await db.get(LoreChunk, duplicate_id)
        if duplicate is not None:
            duplicate.content = content
            duplicate.embedding = embedding
            duplicate.priority = 4
            duplicate.turn_number = turn_number
            await db.flush()
            await db.execute(
                text("UPDATE lore_chunks SET ts_content = to_tsvector('english', content) WHERE id = :id"),
                {"id": str(duplicate.id)},
            )
        logger.info(
            "LORE_DEDUP: promoted near-duplicate context_change for session=%s "
            "(existing chunk=%s)", str(session_id), duplicate_id,
        )
        if commit:
            await db.commit()
        return

    chunk = LoreChunk(
        session_id=session_id,
        content=content,
        chunk_type="context_change",
        priority=4,
        embedding=embedding,
        turn_number=turn_number,
        created_at=datetime.now(timezone.utc),
    )
    db.add(chunk)
    await db.flush()
    await db.execute(
        text("UPDATE lore_chunks SET ts_content = to_tsvector('english', content) WHERE id = :id"),
        {"id": str(chunk.id)},
    )
    if commit:
        await db.commit()


async def activate_context_change(
    session: SceneSession,
    context_text: str,
    db: AsyncSession,
    turn_number: int | None = None,
) -> None:
    """Replace the one boosted context-change slot atomically."""
    content = context_text.strip()
    if not content:
        return
    await db.execute(
        update(LoreChunk)
        .where(
            LoreChunk.session_id == session.id,
            LoreChunk.chunk_type == "context_change",
            LoreChunk.priority == 4,
        )
        .values(priority=2)
    )
    session.active_context_change = content
    session.context_change_turns_remaining = 3
    await store_context_change_as_lore(
        session_id=session.id,
        context_text=content,
        db=db,
        turn_number=turn_number,
    )
