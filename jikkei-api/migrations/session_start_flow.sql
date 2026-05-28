-- Migration: session_start_flow
-- Run this in Supabase SQL editor if any of these columns/tables are missing.
-- Each block is safe to run even if the object already exists.

-- 0. Drop fail_condition from scenes (column removed from model)
ALTER TABLE public.scenes DROP COLUMN IF EXISTS fail_condition;

-- 1. scene_start_choices table (you may have already created this)
CREATE TABLE IF NOT EXISTS public.scene_start_choices (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id      uuid NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
    text          text NOT NULL,
    display_order int  NOT NULL DEFAULT 0,
    created_at    timestamptz DEFAULT now()
);

-- 2. current_choices column on scene_sessions
ALTER TABLE public.scene_sessions
    ADD COLUMN IF NOT EXISTS current_choices text[] NOT NULL DEFAULT '{}';

-- 3. session_id and session_character_id on lore_chunks (added in earlier migration)
ALTER TABLE public.lore_chunks
    ADD COLUMN IF NOT EXISTS session_id            uuid REFERENCES public.scene_sessions(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS session_character_id  uuid REFERENCES public.session_characters(id) ON DELETE CASCADE;

-- 4. ts_content tsvector on lore_chunks (hybrid RAG)
ALTER TABLE public.lore_chunks
    ADD COLUMN IF NOT EXISTS ts_content tsvector;

-- 5. Make lore_chunks.scene_id nullable (was NOT NULL in old schema; now any one FK may be set)
ALTER TABLE public.lore_chunks
    ALTER COLUMN scene_id DROP NOT NULL;

-- 6. scene_id column on lore_chunks should exist; if it doesn't yet:
-- (safe no-op if already there — ADD COLUMN IF NOT EXISTS handles it)

-- 7. Indexes for lore retrieval performance
CREATE INDEX IF NOT EXISTS idx_lore_chunks_scene_id         ON public.lore_chunks(scene_id);
CREATE INDEX IF NOT EXISTS idx_lore_chunks_session_id       ON public.lore_chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_lore_chunks_session_char_id  ON public.lore_chunks(session_character_id);
CREATE INDEX IF NOT EXISTS idx_scene_start_choices_scene    ON public.scene_start_choices(scene_id, display_order);
CREATE INDEX IF NOT EXISTS idx_session_characters_session   ON public.session_characters(session_id, position);
CREATE INDEX IF NOT EXISTS idx_turn_messages_turn_id        ON public.turn_messages(turn_id, speaker_order);
CREATE INDEX IF NOT EXISTS idx_dialogue_turns_session_turn  ON public.dialogue_turns(session_id, turn_number);
