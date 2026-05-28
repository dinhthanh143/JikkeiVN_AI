-- Migration 014: session_characters.status becomes a strict two-value field.
-- Was: TEXT constrained to ('active', 'left_scene', 'dead', 'unavailable') — only "active"
-- was ever actually checked against in code, the other three values existed but were unused
-- by any code path. Collapsing them all into 'inactive'.
-- Now: TEXT column still, but constrained to 'active' | 'inactive' only —
-- behaves as a boolean in practice without a column type/rename migration.

ALTER TABLE session_characters
  DROP CONSTRAINT IF EXISTS session_characters_status_check;

ALTER TABLE session_characters
  ALTER COLUMN status SET DEFAULT 'active';

UPDATE session_characters SET status = 'active' WHERE status IS NULL OR status = 'active';
UPDATE session_characters SET status = 'inactive' WHERE status IS NOT NULL AND status <> 'active';

ALTER TABLE session_characters
  ADD CONSTRAINT session_characters_status_check CHECK (status IN ('active', 'inactive'));
