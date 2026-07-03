
-- USER PROFILES (display name for DM/player lookup)
CREATE TABLE public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Adventurer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by any authenticated user"
  ON public.user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users manage own profile"
  ON public.user_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'Adventurer'))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Backfill existing users
INSERT INTO public.user_profiles (user_id, display_name)
SELECT id, COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1), 'Adventurer')
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- CAMPAIGNS
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  join_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_dm ON public.campaigns(dm_user_id);
CREATE INDEX idx_campaigns_join_code ON public.campaigns(join_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can look up a campaign (needed for join-by-code preview).
-- Members-only visibility would break the join flow. Data exposed is name/DM only.
CREATE POLICY "campaigns readable by any authenticated user"
  ON public.campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "DM creates own campaigns"
  ON public.campaigns FOR INSERT TO authenticated WITH CHECK (auth.uid() = dm_user_id);
CREATE POLICY "DM updates own campaigns"
  ON public.campaigns FOR UPDATE TO authenticated
  USING (auth.uid() = dm_user_id) WITH CHECK (auth.uid() = dm_user_id);
CREATE POLICY "DM deletes own campaigns"
  ON public.campaigns FOR DELETE TO authenticated USING (auth.uid() = dm_user_id);
CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CAMPAIGN MEMBERS
CREATE TABLE public.campaign_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  player_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, player_user_id)
);
CREATE INDEX idx_cm_campaign ON public.campaign_members(campaign_id);
CREATE INDEX idx_cm_player ON public.campaign_members(player_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_members TO authenticated;
GRANT ALL ON public.campaign_members TO service_role;
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

-- Security definer helper (avoids recursive policy references)
CREATE OR REPLACE FUNCTION public.is_campaign_dm(_campaign_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.campaigns WHERE id = _campaign_id AND dm_user_id = auth.uid())
$$;

CREATE POLICY "player sees own memberships"
  ON public.campaign_members FOR SELECT TO authenticated
  USING (auth.uid() = player_user_id OR public.is_campaign_dm(campaign_id));
CREATE POLICY "player joins as self"
  ON public.campaign_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = player_user_id);
CREATE POLICY "player updates own membership"
  ON public.campaign_members FOR UPDATE TO authenticated
  USING (auth.uid() = player_user_id) WITH CHECK (auth.uid() = player_user_id);
CREATE POLICY "player or dm removes membership"
  ON public.campaign_members FOR DELETE TO authenticated
  USING (auth.uid() = player_user_id OR public.is_campaign_dm(campaign_id));
