CREATE OR REPLACE FUNCTION public.is_campaign_member(_campaign_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.campaign_members WHERE campaign_id = _campaign_id AND player_user_id = auth.uid())
$$;

CREATE TABLE public.campaign_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'World Map',
  image_url text NOT NULL,
  storage_path text,
  width_px integer NOT NULL DEFAULT 0,
  height_px integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_maps TO authenticated;
GRANT ALL ON public.campaign_maps TO service_role;
ALTER TABLE public.campaign_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DM manages campaign maps" ON public.campaign_maps FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));
CREATE POLICY "Members view active campaign maps" ON public.campaign_maps FOR SELECT TO authenticated
  USING (is_active AND public.is_campaign_member(campaign_id));

CREATE TABLE public.map_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.campaign_maps(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  x_percent double precision NOT NULL DEFAULT 50,
  y_percent double precision NOT NULL DEFAULT 50,
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  pin_type text NOT NULL DEFAULT 'poi',
  placed_by text NOT NULL DEFAULT 'dm',
  player_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  is_visible_to_players boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT map_pins_pin_type_check CHECK (pin_type IN ('visited','discovered','dangerous','poi','home','dungeon','city','mystery')),
  CONSTRAINT map_pins_placed_by_check CHECK (placed_by IN ('dm','player'))
);

CREATE INDEX map_pins_map_id_idx ON public.map_pins(map_id);
CREATE INDEX campaign_maps_campaign_id_idx ON public.campaign_maps(campaign_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_pins TO authenticated;
GRANT ALL ON public.map_pins TO service_role;
ALTER TABLE public.map_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DM manages map pins" ON public.map_pins FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));
CREATE POLICY "Members view visible pins" ON public.map_pins FOR SELECT TO authenticated
  USING (public.is_campaign_member(campaign_id) AND (is_visible_to_players OR player_user_id = auth.uid()));
CREATE POLICY "Players add own pins" ON public.map_pins FOR INSERT TO authenticated
  WITH CHECK (
    public.is_campaign_member(campaign_id)
    AND placed_by = 'player'
    AND player_user_id = auth.uid()
    AND pin_type IN ('visited','poi')
  );
CREATE POLICY "Players update own pins" ON public.map_pins FOR UPDATE TO authenticated
  USING (player_user_id = auth.uid() AND placed_by = 'player')
  WITH CHECK (player_user_id = auth.uid() AND placed_by = 'player' AND pin_type IN ('visited','poi'));
CREATE POLICY "Players delete own pins" ON public.map_pins FOR DELETE TO authenticated
  USING (player_user_id = auth.uid() AND placed_by = 'player');

CREATE TRIGGER trg_campaign_maps_updated_at BEFORE UPDATE ON public.campaign_maps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_map_pins_updated_at BEFORE UPDATE ON public.map_pins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.map_pins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_maps;

CREATE POLICY "DM uploads campaign maps" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-maps' AND (storage.foldername(name))[1] = (auth.uid())::text);
CREATE POLICY "DM updates campaign maps" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'campaign-maps' AND (storage.foldername(name))[1] = (auth.uid())::text);
CREATE POLICY "DM deletes campaign maps" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-maps' AND (storage.foldername(name))[1] = (auth.uid())::text);
CREATE POLICY "Authenticated read campaign maps" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'campaign-maps');