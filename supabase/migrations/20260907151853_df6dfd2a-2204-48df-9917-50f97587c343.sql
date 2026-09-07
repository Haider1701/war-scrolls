ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS pending_level_up boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS level_up_approved_by_dm boolean NOT NULL DEFAULT false;