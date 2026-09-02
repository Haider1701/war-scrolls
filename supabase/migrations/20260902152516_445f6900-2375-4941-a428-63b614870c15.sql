-- ============ Combat encounters ============
CREATE TABLE public.combat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Combat',
  is_active boolean NOT NULL DEFAULT true,
  current_turn_index integer NOT NULL DEFAULT 0,
  round_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.combat_sessions TO authenticated;
GRANT ALL ON public.combat_sessions TO service_role;
ALTER TABLE public.combat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DM manages combat sessions" ON public.combat_sessions FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));

CREATE POLICY "Members view active combat" ON public.combat_sessions FOR SELECT TO authenticated
  USING (public.is_campaign_member(campaign_id));

CREATE TRIGGER trg_combat_sessions_updated_at BEFORE UPDATE ON public.combat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.combat_combatants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combat_session_id uuid NOT NULL REFERENCES public.combat_sessions(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Combatant',
  combatant_type text NOT NULL DEFAULT 'monster',
  character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  player_user_id uuid,
  initiative_roll integer NOT NULL DEFAULT 0,
  initiative_modifier integer NOT NULL DEFAULT 0,
  dex_score integer NOT NULL DEFAULT 10,
  hp_current integer NOT NULL DEFAULT 0,
  hp_max integer NOT NULL DEFAULT 0,
  hp_temp integer NOT NULL DEFAULT 0,
  ac integer NOT NULL DEFAULT 10,
  speed integer NOT NULL DEFAULT 30,
  is_defeated boolean NOT NULL DEFAULT false,
  turn_order integer NOT NULL DEFAULT 0,
  status_conditions text[] NOT NULL DEFAULT '{}',
  concentration_spell text,
  death_save_successes integer NOT NULL DEFAULT 0,
  death_save_failures integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#ff6a00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.combat_combatants TO authenticated;
GRANT ALL ON public.combat_combatants TO service_role;
ALTER TABLE public.combat_combatants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DM manages combatants" ON public.combat_combatants FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));

CREATE POLICY "Members view combatants" ON public.combat_combatants FOR SELECT TO authenticated
  USING (public.is_campaign_member(campaign_id));

CREATE TRIGGER trg_combat_combatants_updated_at BEFORE UPDATE ON public.combat_combatants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_combatants_session ON public.combat_combatants(combat_session_id, turn_order);
CREATE INDEX idx_combat_sessions_campaign ON public.combat_sessions(campaign_id, is_active);

ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_combatants;

-- ============ Map storage upload fix ============
DROP POLICY IF EXISTS "DM uploads campaign maps" ON storage.objects;
DROP POLICY IF EXISTS "DM updates campaign maps" ON storage.objects;
DROP POLICY IF EXISTS "DM deletes campaign maps" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read campaign maps" ON storage.objects;

CREATE POLICY "Campaign map upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'campaign-maps'
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.dm_user_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Campaign map update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'campaign-maps'
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.dm_user_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Campaign map delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'campaign-maps'
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.dm_user_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Campaign map read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'campaign-maps');