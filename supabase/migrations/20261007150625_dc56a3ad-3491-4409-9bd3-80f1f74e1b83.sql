ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS in_game_age text;
CREATE TABLE public.character_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('level_up','session','death_save','npc_met','map_discovery','milestone')),
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  linked_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  linked_npc_id uuid REFERENCES public.npcs(id) ON DELETE SET NULL,
  event_date text,
  level_at integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_events TO authenticated;
GRANT ALL ON public.character_events TO service_role;
ALTER TABLE public.character_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages character events" ON public.character_events FOR ALL TO authenticated
  USING (public.is_character_owner(character_id)) WITH CHECK (public.is_character_owner(character_id));
CREATE POLICY "DM views shared character events" ON public.character_events FOR SELECT TO authenticated
  USING (public.is_shared_with_dm(character_id));