
-- DM read access to characters (and related tables) shared via campaign_members

CREATE OR REPLACE FUNCTION public.is_shared_with_dm(_character_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_members m
    JOIN public.campaigns c ON c.id = m.campaign_id
    WHERE m.character_id = _character_id
      AND c.dm_user_id = auth.uid()
  )
$$;

-- SELECT policies granting DMs read-only access to shared characters + related rows
CREATE POLICY "DM reads shared characters" ON public.characters
  FOR SELECT USING (public.is_shared_with_dm(id));

CREATE POLICY "DM reads shared abilities" ON public.ability_scores
  FOR SELECT USING (public.is_shared_with_dm(character_id));

CREATE POLICY "DM reads shared skills" ON public.skills
  FOR SELECT USING (public.is_shared_with_dm(character_id));

CREATE POLICY "DM reads shared attacks" ON public.attacks
  FOR SELECT USING (public.is_shared_with_dm(character_id));

CREATE POLICY "DM reads shared spells" ON public.spells
  FOR SELECT USING (public.is_shared_with_dm(character_id));

CREATE POLICY "DM reads shared spell_meta" ON public.spell_meta
  FOR SELECT USING (public.is_shared_with_dm(character_id));

CREATE POLICY "DM reads shared traits" ON public.traits
  FOR SELECT USING (public.is_shared_with_dm(character_id));

CREATE POLICY "DM reads shared equipment" ON public.equipment
  FOR SELECT USING (public.is_shared_with_dm(character_id));

CREATE POLICY "DM reads shared currency" ON public.currency
  FOR SELECT USING (public.is_shared_with_dm(character_id));

CREATE POLICY "DM reads shared sessions" ON public.sessions
  FOR SELECT USING (public.is_shared_with_dm(character_id));

CREATE POLICY "DM reads shared npcs" ON public.npcs
  FOR SELECT USING (public.is_shared_with_dm(character_id));

CREATE POLICY "DM reads shared free_notes" ON public.free_notes
  FOR SELECT USING (public.is_shared_with_dm(character_id));

CREATE POLICY "DM reads shared character_images" ON public.character_images
  FOR SELECT USING (public.is_shared_with_dm(character_id));
