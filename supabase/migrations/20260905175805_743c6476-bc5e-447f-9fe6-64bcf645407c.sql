DROP POLICY IF EXISTS "Campaign map read" ON storage.objects;

CREATE POLICY "Campaign map read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'campaign-maps'
  AND EXISTS (
    SELECT 1
    FROM public.campaigns c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.dm_user_id = auth.uid()
        OR public.is_campaign_member(c.id)
      )
  )
);

REVOKE EXECUTE ON FUNCTION public.is_campaign_member(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_campaign_member(uuid) TO authenticated, service_role;