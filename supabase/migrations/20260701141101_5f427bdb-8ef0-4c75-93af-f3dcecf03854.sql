
-- 1) Spells: homebrew flags
ALTER TABLE public.spells
  ADD COLUMN IF NOT EXISTS is_homebrew boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gm_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gm_denied boolean NOT NULL DEFAULT false;

-- 2) User preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'ember',
  is_gm boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON public.user_preferences FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Anyone authenticated can see who is a GM (to route notifications)
CREATE POLICY "Authenticated can view GM flags"
  ON public.user_preferences FOR SELECT
  TO authenticated
  USING (true);

-- 3) GM notifications for homebrew approval requests
CREATE TABLE IF NOT EXISTS public.gm_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gm_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE,
  spell_id uuid REFERENCES public.spells(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gm_notifications TO authenticated;
GRANT ALL ON public.gm_notifications TO service_role;

ALTER TABLE public.gm_notifications ENABLE ROW LEVEL SECURITY;

-- GM sees notifications addressed to them
CREATE POLICY "GM reads own notifications"
  ON public.gm_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = gm_user_id OR auth.uid() = from_user_id);

CREATE POLICY "Anyone can insert notification"
  ON public.gm_notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "GM updates own notifications"
  ON public.gm_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = gm_user_id) WITH CHECK (auth.uid() = gm_user_id);

CREATE POLICY "GM or sender deletes"
  ON public.gm_notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = gm_user_id OR auth.uid() = from_user_id);

-- 4) Realtime
ALTER TABLE public.spells REPLICA IDENTITY FULL;
ALTER TABLE public.gm_notifications REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.spells;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gm_notifications;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 5) Allow GM to approve/deny any spell (extends existing owner policy)
DROP POLICY IF EXISTS "GM can review homebrew spells" ON public.spells;
CREATE POLICY "GM can review homebrew spells"
  ON public.spells FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_preferences p WHERE p.user_id = auth.uid() AND p.is_gm = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_preferences p WHERE p.user_id = auth.uid() AND p.is_gm = true));
