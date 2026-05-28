-- Lossless Redo support: each generated turn stores the runtime state that
-- existed immediately before it was applied.

ALTER TABLE dialogue_turns
    ADD COLUMN IF NOT EXISTS state_before JSONB NULL;
