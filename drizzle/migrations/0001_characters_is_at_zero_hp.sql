ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS is_at_zero_hp boolean GENERATED ALWAYS AS (coalesce(hp_max,0) > 0 AND coalesce(hp_current,0) <= 0) STORED;