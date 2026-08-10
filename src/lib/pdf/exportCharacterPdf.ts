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

  return { character, abilities, skills, attacks, spells, spellMeta, currency, equipment, traits, notes, sessions, npcs, images };
}

export type ExportOpts = { exportNote?: string; mainOnly?: boolean };

export function pdfFileName(character: Character) {
  const clean = (character.name || "character").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "");
  return `${clean || "Character"}_Journal.pdf`;
}

/** Builds the themed journal PDF as a Blob. */
export async function buildCharacterPdfBlob(character: Character, opts: ExportOpts = {}): Promise<Blob> {
  const [{ pdf }, { CharacterSheetPdf }, { registerThemeFonts }, React] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./CharacterSheetPdf"),
    import("./fonts"),
    import("react"),
  ]);
  const [sheet, fonts] = await Promise.all([
    fetchSheetData(character),
    registerThemeFonts(character.theme, character.custom_theme),
  ]);
  const data: SheetData = { ...sheet, fonts, exportNote: opts.exportNote, mainOnly: opts.mainOnly };
  return await pdf(React.createElement(CharacterSheetPdf, { data }) as any).toBlob();
}

/** Builds and downloads the themed 4-page journal PDF. */
export async function exportCharacterPdf(character: Character, exportNote?: string, opts: ExportOpts = {}) {
  const blob = await buildCharacterPdfBlob(character, { ...opts, exportNote: exportNote ?? opts.exportNote });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = pdfFileName(character);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
