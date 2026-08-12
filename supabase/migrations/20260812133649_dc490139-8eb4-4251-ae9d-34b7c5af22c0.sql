REVOKE EXECUTE ON FUNCTION public.is_campaign_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_campaign_dm(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_shared_with_dm(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_character_owner(uuid) FROM anon;