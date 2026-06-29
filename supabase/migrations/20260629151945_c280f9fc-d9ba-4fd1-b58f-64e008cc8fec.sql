
CREATE OR REPLACE FUNCTION public.is_character_owner(_character_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = _character_id AND user_id = auth.uid())
$$;
