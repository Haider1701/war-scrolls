DROP POLICY IF EXISTS "Campaign map upload" ON storage.objects;
DROP POLICY IF EXISTS "Campaign map update" ON storage.objects;
DROP POLICY IF EXISTS "Campaign map delete" ON storage.objects;
DROP POLICY IF EXISTS "Campaign map read" ON storage.objects;

CREATE POLICY "Campaign map upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'campaign-maps'
  AND EXISTS (SELECT 1 FROM public.campaigns c
              WHERE c.dm_user_id = auth.uid()
                AND c.id::text = (storage.foldername(storage.objects.name))[1])
);

CREATE POLICY "Campaign map update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'campaign-maps'
  AND EXISTS (SELECT 1 FROM public.campaigns c
              WHERE c.dm_user_id = auth.uid()
                AND c.id::text = (storage.foldername(storage.objects.name))[1])
);

CREATE POLICY "Campaign map delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'campaign-maps'
  AND EXISTS (SELECT 1 FROM public.campaigns c
              WHERE c.dm_user_id = auth.uid()
                AND c.id::text = (storage.foldername(storage.objects.name))[1])
);

CREATE POLICY "Campaign map read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'campaign-maps'
  AND EXISTS (SELECT 1 FROM public.campaigns c
              WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
                AND (c.dm_user_id = auth.uid() OR public.is_campaign_member(c.id)))
);