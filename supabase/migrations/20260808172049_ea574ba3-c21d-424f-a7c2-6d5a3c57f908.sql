DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND policyname LIKE 'DM reads shared%'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "DM reads shared characters" ON public.characters FOR SELECT TO authenticated USING (public.is_shared_with_dm(id));
CREATE POLICY "DM reads shared abilities" ON public.ability_scores FOR SELECT TO authenticated USING (public.is_shared_with_dm(character_id));
CREATE POLICY "DM reads shared skills" ON public.skills FOR SELECT TO authenticated USING (public.is_shared_with_dm(character_id));
CREATE POLICY "DM reads shared attacks" ON public.attacks FOR SELECT TO authenticated USING (public.is_shared_with_dm(character_id));
CREATE POLICY "DM reads shared spells" ON public.spells FOR SELECT TO authenticated USING (public.is_shared_with_dm(character_id));
CREATE POLICY "DM reads shared spell_meta" ON public.spell_meta FOR SELECT TO authenticated USING (public.is_shared_with_dm(character_id));
CREATE POLICY "DM reads shared sessions" ON public.sessions FOR SELECT TO authenticated USING (public.is_shared_with_dm(character_id));
CREATE POLICY "DM reads shared npcs" ON public.npcs FOR SELECT TO authenticated USING (public.is_shared_with_dm(character_id));
CREATE POLICY "DM reads shared equipment" ON public.equipment FOR SELECT TO authenticated USING (public.is_shared_with_dm(character_id));
CREATE POLICY "DM reads shared currency" ON public.currency FOR SELECT TO authenticated USING (public.is_shared_with_dm(character_id));
CREATE POLICY "DM reads shared traits" ON public.traits FOR SELECT TO authenticated USING (public.is_shared_with_dm(character_id));
CREATE POLICY "DM reads shared free_notes" ON public.free_notes FOR SELECT TO authenticated USING (public.is_shared_with_dm(character_id));
CREATE POLICY "DM reads shared character_images" ON public.character_images FOR SELECT TO authenticated USING (public.is_shared_with_dm(character_id));

REVOKE EXECUTE ON FUNCTION public.is_shared_with_dm(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_campaign_dm(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM anon, PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.is_shared_with_dm(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_campaign_dm(uuid) TO authenticated;