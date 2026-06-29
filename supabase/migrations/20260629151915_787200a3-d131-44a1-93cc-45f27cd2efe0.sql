
REVOKE EXECUTE ON FUNCTION public.is_character_owner(uuid) FROM PUBLIC, anon;

CREATE POLICY "user portraits read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'character-portraits' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "user portraits insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'character-portraits' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "user portraits update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'character-portraits' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "user portraits delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'character-portraits' AND (storage.foldername(name))[1] = auth.uid()::text);
