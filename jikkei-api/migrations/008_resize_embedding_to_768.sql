-- Migration 008: Resize lore_chunks.embedding from vector(1536) → vector(768)
-- Reason: switching to Google text-embedding-004 which outputs 768 dimensions.
-- WARNING: This drops all existing embeddings. Re-run embed_scene_setup for all scenes after applying.

BEGIN;

-- Drop the existing HNSW index (can't alter index on dimension change)
DROP INDEX IF EXISTS lore_chunks_embedding_idx;

-- Alter the column type — existing rows become NULL (old 1536-dim vectors are incompatible)
ALTER TABLE lore_chunks
    ALTER COLUMN embedding TYPE vector(768)
    USING NULL;

-- Recreate the HNSW index for 768-dim cosine similarity search
CREATE INDEX lore_chunks_embedding_idx
    ON lore_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

COMMIT;
