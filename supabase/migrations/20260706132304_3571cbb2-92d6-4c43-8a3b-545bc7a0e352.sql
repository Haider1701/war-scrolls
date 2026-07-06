ALTER TABLE public.npcs ADD COLUMN session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_npcs_session_id ON public.npcs(session_id);