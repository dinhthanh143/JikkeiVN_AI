-- Serialize AI turns without holding a database transaction open during the
-- provider call, and freeze the cacheable scene prefix for active sessions.

ALTER TABLE public.scene_sessions
  ADD COLUMN IF NOT EXISTS scene_description_snapshot text,
  ADD COLUMN IF NOT EXISTS scene_is_nsfw_snapshot boolean,
  ADD COLUMN IF NOT EXISTS stable_prompt text,
  ADD COLUMN IF NOT EXISTS turn_claim_id uuid,
  ADD COLUMN IF NOT EXISTS turn_claimed_at timestamptz;

COMMENT ON COLUMN public.scene_sessions.stable_prompt IS
  'Byte-stable system prompt snapshot; invalidated only by session-owned static edits.';
COMMENT ON COLUMN public.scene_sessions.turn_claim_id IS
  'Short-lived cross-worker lease preventing concurrent AI turns for one session.';

UPDATE public.scene_sessions AS ss
SET
  scene_description_snapshot = COALESCE(ss.scene_description_snapshot, s.description, ''),
  scene_is_nsfw_snapshot = COALESCE(ss.scene_is_nsfw_snapshot, s.is_nsfw, false)
FROM public.scenes AS s
WHERE s.id = ss.scene_id
  AND (ss.scene_description_snapshot IS NULL OR ss.scene_is_nsfw_snapshot IS NULL);

-- Backgrounds became session-owned in the runtime before a numbered migration
-- recorded the column. Add it here so production schemas match the model, then
-- snapshot template backgrounds for sessions that predate cloning.
ALTER TABLE public.backgrounds
  ADD COLUMN IF NOT EXISTS session_id uuid
    REFERENCES public.scene_sessions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_backgrounds_session_id
  ON public.backgrounds(session_id);

INSERT INTO public.backgrounds (id, scene_id, session_id, name, image_url)
SELECT gen_random_uuid(), ss.scene_id, ss.id, template.name, template.image_url
FROM public.scene_sessions ss
JOIN public.backgrounds template
  ON template.scene_id = ss.scene_id
 AND template.session_id IS NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.backgrounds owned
  WHERE owned.session_id = ss.id
    AND owned.name = template.name
    AND owned.image_url = template.image_url
);

CREATE TABLE IF NOT EXISTS public.session_character_expressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_character_id uuid NOT NULL
    REFERENCES public.session_characters(id) ON DELETE CASCADE,
  slot_key varchar(50) NOT NULL,
  display_name varchar(100) NOT NULL,
  image_url varchar(500),
  display_order integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_session_character_expressions_char_slot
  ON public.session_character_expressions(session_character_id, slot_key);
ALTER TABLE public.session_character_expressions ENABLE ROW LEVEL SECURITY;

INSERT INTO public.session_character_expressions (
  id, session_character_id, slot_key, display_name, image_url, display_order
)
SELECT
  gen_random_uuid(), sc.id, ce.slot_key, ce.display_name, ce.image_url, ce.display_order
FROM public.session_characters sc
JOIN public.character_expressions ce ON ce.character_id = sc.source_character_id
ON CONFLICT (session_character_id, slot_key) DO NOTHING;
