
CREATE TABLE public.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL DEFAULT '',
  subtitle text DEFAULT '',
  class_level text DEFAULT '',
  race text DEFAULT '',
  alignment text DEFAULT '',
  background text DEFAULT '',
  proficiency_bonus int DEFAULT 2,
  passive_perception int DEFAULT 10,
  affliction_note text DEFAULT '',
  image_url text DEFAULT '',
  hp_current int DEFAULT 10,
  hp_max int DEFAULT 10,
  armor_class int DEFAULT 10,
  speed int DEFAULT 30,
  languages text DEFAULT '',
  armor_prof text DEFAULT '',
  weapons_prof text DEFAULT '',
  tools_prof text DEFAULT '',
  backstory text DEFAULT '',
  features jsonb DEFAULT '[]'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.characters TO authenticated;
GRANT ALL ON public.characters TO service_role;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own characters" ON public.characters FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_character_owner(_character_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = _character_id AND user_id = auth.uid())
$$;

CREATE TABLE public.ability_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL UNIQUE REFERENCES public.characters(id) ON DELETE CASCADE,
  strength int DEFAULT 10, dexterity int DEFAULT 10, constitution int DEFAULT 10,
  intelligence int DEFAULT 10, wisdom int DEFAULT 10, charisma int DEFAULT 10
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ability_scores TO authenticated;
GRANT ALL ON public.ability_scores TO service_role;
ALTER TABLE public.ability_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own abilities" ON public.ability_scores FOR ALL TO authenticated USING (public.is_character_owner(character_id)) WITH CHECK (public.is_character_owner(character_id));

CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  name text NOT NULL, modifier int DEFAULT 0, proficient boolean DEFAULT false, kind text DEFAULT 'skill'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills TO authenticated;
GRANT ALL ON public.skills TO service_role;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own skills" ON public.skills FOR ALL TO authenticated USING (public.is_character_owner(character_id)) WITH CHECK (public.is_character_owner(character_id));

CREATE TABLE public.attacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  weapon_name text DEFAULT '', attack_bonus text DEFAULT '', damage_dice text DEFAULT '', damage_type text DEFAULT ''
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attacks TO authenticated;
GRANT ALL ON public.attacks TO service_role;
ALTER TABLE public.attacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attacks" ON public.attacks FOR ALL TO authenticated USING (public.is_character_owner(character_id)) WITH CHECK (public.is_character_owner(character_id));

CREATE TABLE public.spells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  spell_level int DEFAULT 0, name text DEFAULT '', school text DEFAULT '',
  casting_time text DEFAULT '', range text DEFAULT '', components text DEFAULT '',
  duration text DEFAULT '', description text DEFAULT '', upcast_note text DEFAULT ''
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spells TO authenticated;
GRANT ALL ON public.spells TO service_role;
ALTER TABLE public.spells ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own spells" ON public.spells FOR ALL TO authenticated USING (public.is_character_owner(character_id)) WITH CHECK (public.is_character_owner(character_id));

CREATE TABLE public.spell_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL UNIQUE REFERENCES public.characters(id) ON DELETE CASCADE,
  spellcasting_ability text DEFAULT 'Wisdom',
  spell_save_dc int DEFAULT 13, spell_attack_bonus int DEFAULT 5,
  slot_counts jsonb DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0}'::jsonb,
  slots_used jsonb DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0}'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spell_meta TO authenticated;
GRANT ALL ON public.spell_meta TO service_role;
ALTER TABLE public.spell_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own spell_meta" ON public.spell_meta FOR ALL TO authenticated USING (public.is_character_owner(character_id)) WITH CHECK (public.is_character_owner(character_id));

CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  session_number int DEFAULT 1, title text DEFAULT '', date_played text DEFAULT '',
  notes text[] DEFAULT ARRAY[]::text[], encounter_notes text DEFAULT ''
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.sessions FOR ALL TO authenticated USING (public.is_character_owner(character_id)) WITH CHECK (public.is_character_owner(character_id));

CREATE TABLE public.npcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  name text DEFAULT '', role text DEFAULT '', description text DEFAULT '',
  disposition text DEFAULT 'neutral', emoji_icon text DEFAULT '👤'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.npcs TO authenticated;
GRANT ALL ON public.npcs TO service_role;
ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own npcs" ON public.npcs FOR ALL TO authenticated USING (public.is_character_owner(character_id)) WITH CHECK (public.is_character_owner(character_id));

CREATE TABLE public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  name text DEFAULT '', emoji_icon text DEFAULT '⚔️', quantity int DEFAULT 1
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment TO authenticated;
GRANT ALL ON public.equipment TO service_role;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own equipment" ON public.equipment FOR ALL TO authenticated USING (public.is_character_owner(character_id)) WITH CHECK (public.is_character_owner(character_id));

CREATE TABLE public.currency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL UNIQUE REFERENCES public.characters(id) ON DELETE CASCADE,
  cp int DEFAULT 0, sp int DEFAULT 0, ep int DEFAULT 0, gp int DEFAULT 0, pp int DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.currency TO authenticated;
GRANT ALL ON public.currency TO service_role;
ALTER TABLE public.currency ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own currency" ON public.currency FOR ALL TO authenticated USING (public.is_character_owner(character_id)) WITH CHECK (public.is_character_owner(character_id));

CREATE TABLE public.traits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL UNIQUE REFERENCES public.characters(id) ON DELETE CASCADE,
  personality text DEFAULT '', ideal text DEFAULT '', bond text DEFAULT '', flaw text DEFAULT ''
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traits TO authenticated;
GRANT ALL ON public.traits TO service_role;
ALTER TABLE public.traits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own traits" ON public.traits FOR ALL TO authenticated USING (public.is_character_owner(character_id)) WITH CHECK (public.is_character_owner(character_id));

CREATE TABLE public.free_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL UNIQUE REFERENCES public.characters(id) ON DELETE CASCADE,
  content text DEFAULT ''
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_notes TO authenticated;
GRANT ALL ON public.free_notes TO service_role;
ALTER TABLE public.free_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own free_notes" ON public.free_notes FOR ALL TO authenticated USING (public.is_character_owner(character_id)) WITH CHECK (public.is_character_owner(character_id));
