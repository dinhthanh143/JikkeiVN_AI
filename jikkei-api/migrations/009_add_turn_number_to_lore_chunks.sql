-- Migration 009: Add turn_number to lore_chunks for redo rollback
-- Each lore chunk written during gameplay now records which turn_number created it.
-- On redo, we DELETE WHERE session_id = :sid AND turn_number = :deleted_turn for clean surgical rollback.
-- Template chunks (scene_id-scoped, written by embed_scene_setup) leave turn_number NULL.

ALTER TABLE lore_chunks
    ADD COLUMN IF NOT EXISTS turn_number INTEGER NULL;

-- Index for fast redo deletes: WHERE session_id = ? AND turn_number = ?
CREATE INDEX IF NOT EXISTS idx_lore_chunks_session_turn
    ON lore_chunks (session_id, turn_number)
    WHERE turn_number IS NOT NULL;

COMMENT ON COLUMN lore_chunks.turn_number IS
    'The dialogue_turns.turn_number that created this chunk. NULL for template chunks. Used by redo rollback to delete lore written by a specific turn.';
