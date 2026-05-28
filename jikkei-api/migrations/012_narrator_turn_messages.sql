-- Migration 012: Narrator support on turn_messages
-- session_character_id becomes nullable; narrator lines (e.g. "2 years later,
-- the kingdom has changed...") belong to no character and have NULL here.
-- speaker_type distinguishes 'character' (default, existing rows) from 'narrator'.

ALTER TABLE turn_messages
    ALTER COLUMN session_character_id DROP NOT NULL;

ALTER TABLE turn_messages
    ADD COLUMN IF NOT EXISTS speaker_type VARCHAR(20) NOT NULL DEFAULT 'character';

-- Defensive: narrator rows must never carry a session_character_id, and
-- character rows must always have one. Keeps the two modes from being mixed up.
ALTER TABLE turn_messages
    ADD CONSTRAINT chk_turn_messages_speaker_consistency
    CHECK (
        (speaker_type = 'character' AND session_character_id IS NOT NULL)
        OR (speaker_type = 'narrator' AND session_character_id IS NULL)
    );

COMMENT ON COLUMN turn_messages.speaker_type IS
    'character (default) or narrator. Narrator lines have NULL session_character_id and render without a name badge / character sprite in the UI.';
