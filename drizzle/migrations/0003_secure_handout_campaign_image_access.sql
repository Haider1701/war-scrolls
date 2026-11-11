DROP POLICY IF EXISTS "Anyone reads public handout images" ON storage.objects;
CREATE POLICY "Campaign members read revealed handout images" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'handouts'
  AND EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.dm_user_id = auth.uid()
        OR (
          public.is_campaign_member(c.id)
          AND (
            EXISTS (SELECT 1 FROM public.handouts h WHERE h.campaign_id = c.id AND h.image_url = name AND h.is_revealed)
            OR EXISTS (SELECT 1 FROM public.lore_pages l WHERE l.campaign_id = c.id AND l.image_url = name AND l.is_visible_to_players)
          )
        )
      )
  )
);