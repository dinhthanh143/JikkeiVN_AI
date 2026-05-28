-- Migration 010: GIN index for hybrid search keyword (ts_content) lookups
-- ts_content was already a column but never indexed or populated.
-- This index makes `ts_content @@ plainto_tsquery(...)` fast at scale.

CREATE INDEX IF NOT EXISTS idx_lore_chunks_ts_content
    ON lore_chunks
    USING GIN (ts_content);

-- Backfill ts_content for any existing rows that predate hybrid search
-- (template chunks written before this migration, or rows where the
-- UPDATE in embed_scene_setup hasn't run yet).
UPDATE lore_chunks
SET ts_content = to_tsvector('english', content)
WHERE ts_content IS NULL;

COMMENT ON COLUMN lore_chunks.ts_content IS
    'Keyword search vector (to_tsvector) for hybrid search. Populated on every write alongside embedding. Used with plainto_tsquery + ts_rank in search_relevant_lore Stage 2 RRF fusion.';
