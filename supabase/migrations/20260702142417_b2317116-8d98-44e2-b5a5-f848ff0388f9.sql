
-- Per-character themes
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS custom_theme jsonb;

-- Reusable custom-theme library (per user)
CREATE TABLE IF NOT EXISTS public.user_custom_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  theme jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_custom_themes TO authenticated;
GRANT ALL ON public.user_custom_themes TO service_role;

ALTER TABLE public.user_custom_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own custom themes"
  ON public.user_custom_themes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_user_custom_themes_updated ON public.user_custom_themes;
CREATE TRIGGER trg_user_custom_themes_updated
  BEFORE UPDATE ON public.user_custom_themes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
