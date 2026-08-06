import { supabase } from "@/integrations/supabase/client";
import type {
  Abilities, Attack, Character, CharacterImage, Currency, Equipment, FreeNotes,
  NPC, Session, Skill, Spell, SpellMeta, Traits,
} from "./types";

const db = supabase as any;

export type CodexData = {
  character: Character;
  abilities: Abilities | null;
  skills: Skill[];
  attacks: Attack[];
  spells: Spell[];
  spellMeta: SpellMeta | null;
  currency: Currency | null;
  equipment: Equipment[];
  traits: Traits | null;
  notes: FreeNotes | null;
  sessions: Session[];
  npcs: NPC[];
  images: CharacterImage[];
};

export async function loadCodexData(character: Character): Promise<CodexData> {
  const id = character.id;
  const one = async (table: string) =>
    (await db.from(table).select("*").eq("character_id", id).maybeSingle()).data ?? null;
  const many = async (table: string, order?: string) => {
    let q = db.from(table).select("*").eq("character_id", id);
    if (order) q = q.order(order, { ascending: true });
    return (await q).data ?? [];
  };

  const [abilities, skills, attacks, spells, spellMeta, currency, equipment, traits, notes, sessions, npcs, images] =
    await Promise.all([
      one("ability_scores"),
      many("skills"),
      many("attacks"),
      many("spells", "spell_level"),
      one("spell_meta"),
      one("currency"),
      many("equipment"),
      one("traits"),
      one("free_notes"),
      many("sessions", "session_number"),
      many("npcs"),
      many("character_images", "sort_order"),
    ]);

  return {
    character, abilities, skills, attacks, spells, spellMeta,
    currency, equipment, traits, notes, sessions, npcs, images,
  };
}

/** Splits a blob of text into clean lines/entries for panel rendering. */
export function toEntries(text?: string | null): string[] {
  if (!text) return [];
  return String(text)
    .split(/\r?\n|(?:\s+•\s+)|(?:\s*;\s*)/)
    .map((s) => s.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean);
}
