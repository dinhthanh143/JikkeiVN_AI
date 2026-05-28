-- Scene engine schema migration for Jikkei API.
-- Run in Supabase SQL Editor.
-- This migration only adds new scene-engine tables and does not modify existing users/refresh_tokens tables.

BEGIN;

-- Required for semantic search embeddings.
CREATE EXTENSION IF NOT EXISTS vector;

-- ── PART A: CORE SCENE TABLES ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    scene_context TEXT NOT NULL,
    world_rules TEXT,
    win_condition TEXT,
    fail_condition TEXT,
    dialogue_mode TEXT NOT NULL DEFAULT 'both'
        CHECK (dialogue_mode IN ('options', 'prompt', 'both')),
    game_mode TEXT NOT NULL DEFAULT 'normal'
        CHECK (game_mode IN ('story', 'normal', 'hardcore')),
    starting_background_id UUID,
    tier TEXT NOT NULL DEFAULT 'free'
        CHECK (tier IN ('free', 'pro')),
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID REFERENCES public.scenes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    avatar_url TEXT,
    avatar_source TEXT NOT NULL DEFAULT 'upload'
        CHECK (avatar_source IN ('upload', 'generated')),
    generation_prompt TEXT,
    voice_id TEXT,
    position TEXT NOT NULL DEFAULT 'center'
        CHECK (position IN ('left', 'center', 'right')),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.character_expressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE,
    slot_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    image_url TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    UNIQUE(character_id, slot_key)
);

CREATE TABLE IF NOT EXISTS public.character_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE,
    attr_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    initial_value INTEGER NOT NULL DEFAULT 50,
    min_value INTEGER NOT NULL DEFAULT 0,
    max_value INTEGER NOT NULL DEFAULT 100,
    is_visible_to_player BOOLEAN DEFAULT TRUE,
    is_builtin BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    UNIQUE(character_id, attr_key)
);

CREATE TABLE IF NOT EXISTS public.character_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE,
    rule_text TEXT NOT NULL,
    priority INTEGER NOT NULL,
    UNIQUE(character_id, priority)
);

CREATE TABLE IF NOT EXISTS public.character_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE,
    attr_key TEXT NOT NULL,
    operator TEXT NOT NULL CHECK (operator IN ('lt', 'gt', 'lte', 'gte', 'eq')),
    threshold INTEGER NOT NULL,
    behavior_instruction TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.backgrounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID REFERENCES public.scenes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    time_of_day TEXT DEFAULT 'day'
        CHECK (time_of_day IN ('day', 'night', 'dusk', 'dawn')),
    mood TEXT DEFAULT 'neutral'
        CHECK (mood IN ('calm', 'tense', 'eerie', 'warm', 'neutral')),
    transition_type TEXT DEFAULT 'fade'
        CHECK (transition_type IN ('fade', 'cut', 'slide')),
    display_order INTEGER DEFAULT 0
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_starting_bg'
          AND conrelid = 'public.scenes'::regclass
    ) THEN
        ALTER TABLE public.scenes
            ADD CONSTRAINT fk_starting_bg
            FOREIGN KEY (starting_background_id)
            REFERENCES public.backgrounds(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.lore_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID REFERENCES public.scenes(id) ON DELETE CASCADE,
    character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    chunk_type TEXT NOT NULL
        CHECK (chunk_type IN ('character', 'world', 'rule', 'event', 'context_change')),
    priority INTEGER DEFAULT 0,
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lore_chunks_embedding
    ON public.lore_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_lore_chunks_scene
    ON public.lore_chunks(scene_id);

CREATE INDEX IF NOT EXISTS idx_lore_chunks_priority
    ON public.lore_chunks(priority DESC);

-- ── PART B: RUNTIME SESSION TABLES ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scene_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID REFERENCES public.scenes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    game_mode TEXT NOT NULL
        CHECK (game_mode IN ('story', 'normal', 'hardcore')),
    turn_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_resumable BOOLEAN DEFAULT TRUE,
    attribute_values JSONB DEFAULT '{}'::jsonb,
    current_background_id UUID REFERENCES public.backgrounds(id) ON DELETE SET NULL,
    world_events TEXT[] DEFAULT '{}'::text[],
    history_summary TEXT,
    active_context_change TEXT,
    context_change_turns_remaining INTEGER DEFAULT 0,
    outcome TEXT
        CHECK (outcome IS NULL OR outcome IN ('good_ending', 'bad_ending', 'neutral')),
    outcome_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dialogue_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.scene_sessions(id) ON DELETE CASCADE,
    turn_number INTEGER NOT NULL,
    input_type TEXT NOT NULL
        CHECK (input_type IN ('prompt', 'choice', 'context_change', 'redo')),
    player_input TEXT,
    choice_index INTEGER,
    context_change_text TEXT,
    character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
    dialogue_text TEXT,
    expression_key TEXT,
    attribute_delta JSONB DEFAULT '{}'::jsonb,
    attribute_snapshot JSONB DEFAULT '{}'::jsonb,
    background_changed_to UUID REFERENCES public.backgrounds(id) ON DELETE SET NULL,
    scene_event TEXT,
    options_presented TEXT[],
    raw_ai_response JSONB,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, turn_number)
);

CREATE INDEX IF NOT EXISTS idx_turns_session
    ON public.dialogue_turns(session_id, turn_number);

CREATE INDEX IF NOT EXISTS idx_sessions_user
    ON public.scene_sessions(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_sessions_scene
    ON public.scene_sessions(scene_id);

-- ── PART C: DEFAULT CHARACTER SEEDING TRIGGER ──────────────────────────────

CREATE OR REPLACE FUNCTION public.seed_default_expressions()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.character_expressions
        (character_id, slot_key, display_name, is_default, display_order)
    VALUES
        (NEW.id, 'neutral',   'Neutral',   true, 0),
        (NEW.id, 'happy',     'Happy',     true, 1),
        (NEW.id, 'sad',       'Sad',       true, 2),
        (NEW.id, 'angry',     'Angry',     true, 3),
        (NEW.id, 'flustered', 'Flustered', true, 4),
        (NEW.id, 'shocked',   'Shocked',   true, 5),
        (NEW.id, 'crying',    'Crying',    true, 6),
        (NEW.id, 'smug',      'Smug',      true, 7),
        (NEW.id, 'shy',       'Shy',       true, 8),
        (NEW.id, 'custom_1',  'Custom',    false, 9)
    ON CONFLICT (character_id, slot_key) DO NOTHING;

    INSERT INTO public.character_attributes
        (character_id, attr_key, display_name, initial_value,
         min_value, max_value, is_builtin, is_visible_to_player, display_order)
    VALUES
        (NEW.id, 'affinity',  'Affinity',  50, -100, 100, true, true, 0),
        (NEW.id, 'sanity',    'Sanity',    100, 0,   100, true, true, 1),
        (NEW.id, 'craziness', 'Craziness', 20,  0,   100, true, true, 2)
    ON CONFLICT (character_id, attr_key) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE t.tgname = 'on_character_created'
          AND c.relname = 'characters'
          AND n.nspname = 'public'
    ) THEN
        CREATE TRIGGER on_character_created
            AFTER INSERT ON public.characters
            FOR EACH ROW
            EXECUTE FUNCTION public.seed_default_expressions();
    END IF;
END
$$;

COMMIT;

-- Verification helper queries (optional):
-- SELECT extname FROM pg_extension WHERE extname = 'vector';
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'scenes', 'characters', 'character_expressions', 'character_attributes',
--     'character_rules', 'character_triggers', 'backgrounds', 'lore_chunks',
--     'scene_sessions', 'dialogue_turns'
--   )
-- ORDER BY table_name;
-- SELECT t.tgname
-- FROM pg_trigger t
-- JOIN pg_class c ON c.oid = t.tgrelid
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relname = 'characters' AND t.tgname = 'on_character_created';
-- SELECT indexname
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname IN ('idx_lore_chunks_embedding', 'idx_lore_chunks_scene', 'idx_lore_chunks_priority');