GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_maps TO authenticated;
GRANT ALL ON public.campaign_maps TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_pins TO authenticated;
GRANT ALL ON public.map_pins TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.combat_sessions TO authenticated;
GRANT ALL ON public.combat_sessions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.combat_combatants TO authenticated;
GRANT ALL ON public.combat_combatants TO service_role;