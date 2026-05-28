-- Migration: rls_and_drop_attribute_values
-- Run in Supabase SQL editor. All blocks are idempotent.

-- ══════════════════════════════════════════════════════════════════
-- TASK 5 — Row Level Security
-- ══════════════════════════════════════════════════════════════════

-- ── scenes ────────────────────────────────────────────────────────
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

-- Owner: full access
CREATE POLICY IF NOT EXISTS scenes_owner_all
    ON public.scenes
    FOR ALL
    TO authenticated
    USING  (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Any authenticated user: read public scenes
CREATE POLICY IF NOT EXISTS scenes_public_read
    ON public.scenes
    FOR SELECT
    TO authenticated
    USING (is_public = true);

-- ── characters ────────────────────────────────────────────────────
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

-- Owner: full access (join to scenes.user_id)
CREATE POLICY IF NOT EXISTS characters_owner_all
    ON public.characters
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scenes
            WHERE scenes.id = characters.scene_id
              AND scenes.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.scenes
            WHERE scenes.id = characters.scene_id
              AND scenes.user_id = auth.uid()
        )
    );

-- Any authenticated user: read if parent scene is public
CREATE POLICY IF NOT EXISTS characters_public_read
    ON public.characters
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scenes
            WHERE scenes.id = characters.scene_id
              AND scenes.is_public = true
        )
    );

-- ── character_attributes ──────────────────────────────────────────
ALTER TABLE public.character_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS character_attributes_owner_all
    ON public.character_attributes
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.characters
            JOIN public.scenes ON scenes.id = characters.scene_id
            WHERE characters.id = character_attributes.character_id
              AND scenes.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.characters
            JOIN public.scenes ON scenes.id = characters.scene_id
            WHERE characters.id = character_attributes.character_id
              AND scenes.user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS character_attributes_public_read
    ON public.character_attributes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.characters
            JOIN public.scenes ON scenes.id = characters.scene_id
            WHERE characters.id = character_attributes.character_id
              AND scenes.is_public = true
        )
    );

-- ── character_expressions ─────────────────────────────────────────
ALTER TABLE public.character_expressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS character_expressions_owner_all
    ON public.character_expressions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.characters
            JOIN public.scenes ON scenes.id = characters.scene_id
            WHERE characters.id = character_expressions.character_id
              AND scenes.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.characters
            JOIN public.scenes ON scenes.id = characters.scene_id
            WHERE characters.id = character_expressions.character_id
              AND scenes.user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS character_expressions_public_read
    ON public.character_expressions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.characters
            JOIN public.scenes ON scenes.id = characters.scene_id
            WHERE characters.id = character_expressions.character_id
              AND scenes.is_public = true
        )
    );

-- ── user_credits ──────────────────────────────────────────────────
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- Users can only read and update their own row
CREATE POLICY IF NOT EXISTS user_credits_self_read
    ON public.user_credits
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS user_credits_self_update
    ON public.user_credits
    FOR UPDATE
    TO authenticated
    USING  (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════
-- TASK 6 — Drop scene_sessions.attribute_values
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.scene_sessions DROP COLUMN IF EXISTS attribute_values;
