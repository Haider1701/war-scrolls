
-- 1. Character type + NPC fields
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS character_type text NOT NULL DEFAULT 'player'
    CHECK (character_type IN ('player','npc')),
  ADD COLUMN IF NOT EXISTS npc_quotes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS npc_actions text DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_characters_user_type ON public.characters(user_id, character_type);

-- 2. Character images gallery
CREATE TABLE IF NOT EXISTS public.character_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_images TO authenticated;
GRANT ALL ON public.character_images TO service_role;

ALTER TABLE public.character_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage character images" ON public.character_images;
CREATE POLICY "Owners manage character images"
ON public.character_images
FOR ALL
TO authenticated
USING (public.is_character_owner(character_id))
WITH CHECK (public.is_character_owner(character_id));

CREATE INDEX IF NOT EXISTS idx_character_images_char ON public.character_images(character_id, sort_order);

-- 3. Storage policies on character-portraits bucket (per-user folder)
DROP POLICY IF EXISTS "Users read own portraits" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own portraits" ON storage.objects;
DROP POLICY IF EXISTS "Users update own portraits" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own portraits" ON storage.objects;

CREATE POLICY "Users read own portraits"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'character-portraits' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own portraits"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'character-portraits' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own portraits"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'character-portraits' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own portraits"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'character-portraits' AND (storage.foldername(name))[1] = auth.uid()::text);
