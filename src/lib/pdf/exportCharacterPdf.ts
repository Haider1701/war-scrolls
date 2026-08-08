import { supabase } from "@/integrations/supabase/client";
import type { Character } from "../types";
import type { SheetData } from "./CharacterSheetPdf";

const db = supabase as any;

async function fetchSheetData(character: Character): Promise<SheetData> {
  const id = character.id;
  const one = async (table: string) => (await db.from(table).select("*").eq("character_id", id).maybeSingle()).data ?? null;
  const many = async (table: string, order?: string) => {
    let q = db.from(table).select("*").eq("character_id", id);
    if (order) q = q.order(order, { ascending: true });
    return (await q).data ?? [];
  };

  const [abilities, skills, attacks, spells, spellMeta, currency, equipment, traits, notes, sessions] = await Promise.all([
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
  ]);

  return { character, abilities, skills, attacks, spells, spellMeta, currency, equipment, traits, notes, sessions };
}

/** Builds and downloads a 3-page themed character sheet PDF. */
export async function exportCharacterPdf(character: Character, exportNote?: string) {
  const [{ pdf }, { CharacterSheetPdf }, React] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./CharacterSheetPdf"),
    import("react"),
  ]);
  const data = { ...(await fetchSheetData(character)), exportNote };
  const blob = await pdf(React.createElement(CharacterSheetPdf, { data }) as any).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(character.name || "character").replace(/[^a-z0-9\-_ ]/gi, "").trim() || "character"}-sheet.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
