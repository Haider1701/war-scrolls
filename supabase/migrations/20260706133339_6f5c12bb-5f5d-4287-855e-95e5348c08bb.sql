ALTER TABLE public.campaign_members ADD COLUMN IF NOT EXISTS share_sheet_with_dm boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_shared_with_dm(_character_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_members m
    JOIN public.campaigns c ON c.id = m.campaign_id
    WHERE m.character_id = _character_id
      AND c.dm_user_id = auth.uid()
      AND m.share_sheet_with_dm = true
  )
$$;