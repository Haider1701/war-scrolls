CREATE OR REPLACE FUNCTION public.dm_set_level_up(_character_id uuid, _pending boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.campaign_members m
    JOIN public.campaigns c ON c.id = m.campaign_id
    WHERE m.character_id = _character_id AND c.dm_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not the DM for this character';
  END IF;
  UPDATE public.characters
     SET pending_level_up = _pending, level_up_approved_by_dm = _pending
   WHERE id = _character_id;
END $$;
REVOKE ALL ON FUNCTION public.dm_set_level_up(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dm_set_level_up(uuid, boolean) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.characters;