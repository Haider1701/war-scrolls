CREATE TABLE public.quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  is_visible_to_players boolean NOT NULL DEFAULT false,
  reward text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quests TO authenticated;
GRANT ALL ON public.quests TO service_role;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DM manages campaign quests" ON public.quests FOR ALL TO authenticated USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));
CREATE POLICY "Campaign members read visible quests" ON public.quests FOR SELECT TO authenticated USING (is_visible_to_players AND public.is_campaign_member(campaign_id));
CREATE INDEX quests_campaign_status_order_idx ON public.quests(campaign_id, status, sort_order);

CREATE TABLE public.quest_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id uuid NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quest_objectives TO authenticated;
GRANT ALL ON public.quest_objectives TO service_role;
ALTER TABLE public.quest_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DM manages campaign quest objectives" ON public.quest_objectives FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.quests q WHERE q.id = quest_id AND public.is_campaign_dm(q.campaign_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.quests q WHERE q.id = quest_id AND public.is_campaign_dm(q.campaign_id)));
CREATE POLICY "Members read visible quest objectives" ON public.quest_objectives FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.quests q WHERE q.id = quest_id AND q.is_visible_to_players AND public.is_campaign_member(q.campaign_id)));
CREATE INDEX quest_objectives_quest_order_idx ON public.quest_objectives(quest_id, sort_order);

CREATE TABLE public.handouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  title text NOT NULL,
  handout_type text NOT NULL CHECK (handout_type IN ('letter', 'riddle', 'image', 'note')),
  content text,
  image_url text,
  is_revealed boolean NOT NULL DEFAULT false,
  revealed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.handouts TO authenticated;
GRANT ALL ON public.handouts TO service_role;
ALTER TABLE public.handouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DM manages campaign handouts" ON public.handouts FOR ALL TO authenticated USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));
CREATE POLICY "Members read revealed handouts" ON public.handouts FOR SELECT TO authenticated USING (is_revealed AND public.is_campaign_member(campaign_id));
CREATE INDEX handouts_campaign_created_idx ON public.handouts(campaign_id, created_at DESC);

CREATE TABLE public.lore_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('location', 'faction', 'deity', 'history', 'item', 'other')),
  content text NOT NULL DEFAULT '',
  image_url text,
  is_visible_to_players boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lore_pages TO authenticated;
GRANT ALL ON public.lore_pages TO service_role;
ALTER TABLE public.lore_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DM manages campaign lore" ON public.lore_pages FOR ALL TO authenticated USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));
CREATE POLICY "Members read visible lore" ON public.lore_pages FOR SELECT TO authenticated USING (is_visible_to_players AND public.is_campaign_member(campaign_id));
CREATE INDEX lore_pages_campaign_category_idx ON public.lore_pages(campaign_id, category, title);
CREATE TRIGGER lore_pages_updated_at BEFORE UPDATE ON public.lore_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ai_usage (
  user_id uuid NOT NULL,
  day date NOT NULL DEFAULT current_date,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DM reads own AI usage" ON public.ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.consume_dm_ai_usage()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  is_dm boolean;
  next_count integer;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT coalesce(p.is_gm, false) INTO is_dm FROM public.user_preferences p WHERE p.user_id = current_user_id;
  IF NOT coalesce(is_dm, false) THEN RAISE EXCEPTION 'Only DMs can use these tools'; END IF;
  INSERT INTO public.ai_usage (user_id, day, count) VALUES (current_user_id, current_date, 1)
  ON CONFLICT (user_id, day) DO UPDATE SET count = public.ai_usage.count + 1
  WHERE public.ai_usage.count < 20
  RETURNING count INTO next_count;
  RETURN next_count;
END;
$function$;
REVOKE ALL ON FUNCTION public.consume_dm_ai_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_dm_ai_usage() TO authenticated;

CREATE TABLE public.campaign_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  entry_type text NOT NULL DEFAULT 'session_recap',
  content text NOT NULL,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('draft', 'approved')),
  author_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_journal_entries TO authenticated;
GRANT ALL ON public.campaign_journal_entries TO service_role;
ALTER TABLE public.campaign_journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DM manages campaign journal entries" ON public.campaign_journal_entries FOR ALL TO authenticated USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id) AND author_user_id = auth.uid());
CREATE POLICY "Members read approved campaign journal" ON public.campaign_journal_entries FOR SELECT TO authenticated USING (status = 'approved' AND public.is_campaign_member(campaign_id));
CREATE INDEX campaign_journal_campaign_date_idx ON public.campaign_journal_entries(campaign_id, created_at DESC);

CREATE TABLE public.saved_encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  monsters jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_encounters TO authenticated;
GRANT ALL ON public.saved_encounters TO service_role;
ALTER TABLE public.saved_encounters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DM manages saved encounters" ON public.saved_encounters FOR ALL TO authenticated USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));
CREATE INDEX saved_encounters_campaign_created_idx ON public.saved_encounters(campaign_id, created_at DESC);

DO $publication$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quests;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quest_objectives') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quest_objectives;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'handouts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.handouts;
  END IF;
END;
$publication$;

CREATE POLICY "Anyone reads public handout images" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'handouts');
CREATE POLICY "Campaign DM uploads handout images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'handouts' AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id::text = (storage.foldername(name))[1] AND c.dm_user_id = auth.uid()));
CREATE POLICY "Campaign DM updates handout images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'handouts' AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id::text = (storage.foldername(name))[1] AND c.dm_user_id = auth.uid())) WITH CHECK (bucket_id = 'handouts' AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id::text = (storage.foldername(name))[1] AND c.dm_user_id = auth.uid()));
CREATE POLICY "Campaign DM deletes handout images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'handouts' AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id::text = (storage.foldername(name))[1] AND c.dm_user_id = auth.uid()));