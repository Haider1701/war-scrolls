ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS temp_hp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status_conditions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS concentration_spell text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS show_party_hp boolean NOT NULL DEFAULT false;

CREATE TABLE public.party_status (
  membership_id uuid PRIMARY KEY REFERENCES public.campaign_members(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  player_user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  class_level text NOT NULL DEFAULT '',
  image_url text,
  hp_current integer NOT NULL DEFAULT 0,
  hp_max integer NOT NULL DEFAULT 0,
  temp_hp integer NOT NULL DEFAULT 0,
  armor_class integer NOT NULL DEFAULT 10,
  speed integer NOT NULL DEFAULT 30,
  passive_perception integer NOT NULL DEFAULT 10,
  passive_investigation integer NOT NULL DEFAULT 10,
  passive_insight integer NOT NULL DEFAULT 10,
  hit_dice text NOT NULL DEFAULT '',
  con_mod integer NOT NULL DEFAULT 0,
  status_conditions text[] NOT NULL DEFAULT '{}',
  concentration_spell text,
  death_save_successes integer NOT NULL DEFAULT 0,
  death_save_failures integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.party_status TO authenticated;
GRANT ALL ON public.party_status TO service_role;
ALTER TABLE public.party_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Party visible to campaign" ON public.party_status FOR SELECT TO authenticated
  USING (public.is_campaign_dm(campaign_id) OR public.is_campaign_member(campaign_id));
CREATE POLICY "DM updates party" ON public.party_status FOR UPDATE TO authenticated
  USING (public.is_campaign_dm(campaign_id)) WITH CHECK (public.is_campaign_dm(campaign_id));

-- Build/refresh snapshot rows for a character
CREATE OR REPLACE FUNCTION public.refresh_party_status(_character_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.characters; a public.ability_scores; inv int; ins int; wis int; intl int;
BEGIN
  SELECT * INTO c FROM public.characters WHERE id = _character_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO a FROM public.ability_scores WHERE character_id = _character_id LIMIT 1;
  wis := floor((coalesce(a.wisdom,10) - 10) / 2.0);
  intl := floor((coalesce(a.intelligence,10) - 10) / 2.0);
  SELECT modifier INTO inv FROM public.skills WHERE character_id = _character_id AND name = 'Investigation' AND coalesce(kind,'skill') = 'skill' LIMIT 1;
  SELECT modifier INTO ins FROM public.skills WHERE character_id = _character_id AND name = 'Insight' AND coalesce(kind,'skill') = 'skill' LIMIT 1;
  INSERT INTO public.party_status AS p (membership_id, campaign_id, character_id, player_user_id, name, class_level, image_url,
    hp_current, hp_max, temp_hp, armor_class, speed, passive_perception, passive_investigation, passive_insight,
    hit_dice, con_mod, status_conditions, concentration_spell, death_save_successes, death_save_failures, updated_at)
  SELECT m.id, m.campaign_id, c.id, m.player_user_id, c.name,
    concat_ws(' / ', nullif(c.class_level,''), nullif(c.class_level_2,'')), c.image_url,
    coalesce(c.hp_current,0), coalesce(c.hp_max,0), c.temp_hp, coalesce(c.armor_class,10), coalesce(c.speed,30),
    coalesce(c.passive_perception,10), 10 + coalesce(inv, intl), 10 + coalesce(ins, wis),
    coalesce(c.hit_dice,''), floor((coalesce(a.constitution,10) - 10) / 2.0)::int,
    c.status_conditions, c.concentration_spell, c.death_save_successes, c.death_save_failures, now()
  FROM public.campaign_members m WHERE m.character_id = c.id
  ON CONFLICT (membership_id) DO UPDATE SET
    character_id = EXCLUDED.character_id, name = EXCLUDED.name, class_level = EXCLUDED.class_level, image_url = EXCLUDED.image_url,
    hp_current = EXCLUDED.hp_current, hp_max = EXCLUDED.hp_max, temp_hp = EXCLUDED.temp_hp, armor_class = EXCLUDED.armor_class,
    speed = EXCLUDED.speed, passive_perception = EXCLUDED.passive_perception, passive_investigation = EXCLUDED.passive_investigation,
    passive_insight = EXCLUDED.passive_insight, hit_dice = EXCLUDED.hit_dice, con_mod = EXCLUDED.con_mod,
    status_conditions = EXCLUDED.status_conditions, concentration_spell = EXCLUDED.concentration_spell,
    death_save_successes = EXCLUDED.death_save_successes, death_save_failures = EXCLUDED.death_save_failures, updated_at = now();
END $$;
REVOKE EXECUTE ON FUNCTION public.refresh_party_status(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_character_party_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.refresh_party_status(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER character_party_sync AFTER UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION public.trg_character_party_sync();

CREATE OR REPLACE FUNCTION public.trg_member_party_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.character_id IS NULL THEN DELETE FROM public.party_status WHERE membership_id = NEW.id;
  ELSE PERFORM public.refresh_party_status(NEW.character_id); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER member_party_sync AFTER INSERT OR UPDATE OF character_id ON public.campaign_members FOR EACH ROW EXECUTE FUNCTION public.trg_member_party_sync();

-- DM edits on the party card write back to the character
CREATE OR REPLACE FUNCTION public.trg_party_to_character()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  UPDATE public.characters SET hp_current = NEW.hp_current, temp_hp = NEW.temp_hp,
    status_conditions = NEW.status_conditions, concentration_spell = NEW.concentration_spell,
    death_save_successes = NEW.death_save_successes, death_save_failures = NEW.death_save_failures
  WHERE id = NEW.character_id;
  RETURN NEW;
END $$;
CREATE TRIGGER party_to_character AFTER UPDATE ON public.party_status FOR EACH ROW EXECUTE FUNCTION public.trg_party_to_character();

CREATE OR REPLACE FUNCTION public.dm_long_rest(_campaign_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_campaign_dm(_campaign_id) THEN RAISE EXCEPTION 'Only the DM can call a long rest'; END IF;
  UPDATE public.party_status SET hp_current = hp_max, temp_hp = 0, status_conditions = '{}', concentration_spell = NULL,
    death_save_successes = 0, death_save_failures = 0 WHERE campaign_id = _campaign_id;
  UPDATE public.spell_meta SET slots_used = '{}'::jsonb
    WHERE character_id IN (SELECT character_id FROM public.campaign_members WHERE campaign_id = _campaign_id AND character_id IS NOT NULL);
END $$;
REVOKE EXECUTE ON FUNCTION public.dm_long_rest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dm_long_rest(uuid) TO authenticated;

-- Backfill
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT DISTINCT character_id FROM public.campaign_members WHERE character_id IS NOT NULL LOOP
    PERFORM public.refresh_party_status(r.character_id);
  END LOOP;
END $$;

ALTER TABLE public.party_status REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_status;