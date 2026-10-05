CREATE TABLE public.npc_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  npc_id uuid NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'unknown' CHECK (relationship_type IN ('ally','hostile','neutral','unknown')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (npc_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.npc_relationships TO authenticated;
GRANT ALL ON public.npc_relationships TO service_role;
ALTER TABLE public.npc_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages npc relationships" ON public.npc_relationships FOR ALL TO authenticated
  USING (public.is_character_owner(character_id)) WITH CHECK (public.is_character_owner(character_id));
CREATE POLICY "DM views shared npc relationships" ON public.npc_relationships FOR SELECT TO authenticated
  USING (public.is_shared_with_dm(character_id));