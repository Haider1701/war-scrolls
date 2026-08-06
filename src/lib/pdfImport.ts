/**
 * Imports an official D&D 5e character sheet PDF into the codex.
 * Strategy: read AcroForm fields (official fillable sheets), fall back to
 * raw text extraction for flat/scanned-style exports.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Character } from "./types";
import { SKILL_LIST, SAVE_LIST, profBonusForLevel, parseLevel } from "./types";

const db = supabase as any;

export type ImportReport = {
  fieldsFound: number;
  applied: string[];
  missing: string[];
  mode: "form" | "text";
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

type Fields = Record<string, string>;

/** Reads every text/checkbox field from the PDF, keyed by normalized name. */
async function readFormFields(bytes: ArrayBuffer): Promise<Fields> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const out: Fields = {};
  let form: any;
  try { form = doc.getForm(); } catch { return out; }
  for (const f of form.getFields()) {
    const name = norm(f.getName());
    try {
      if (typeof f.getText === "function") {
        const v = f.getText();
        if (v && String(v).trim()) out[name] = String(v).trim();
      } else if (typeof f.isChecked === "function") {
        out[name] = f.isChecked() ? "on" : "";
      }
    } catch { /* unsupported field type */ }
  }
  return out;
}

async function readText(bytes: ArrayBuffer): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(" ") + "\n";
  }
  return text;
}

function pick(f: Fields, ...names: string[]): string {
  for (const n of names) {
    const v = f[norm(n)];
    if (v && v.trim()) return v.trim();
  }
  return "";
}
const num = (s: string, fallback = 0) => {
  const m = String(s ?? "").match(/-?\d+/);
  return m ? parseInt(m[0], 10) : fallback;
};

/** Official sheet spell field index -> spell level. */
function spellFieldLevel(n: number): number | null {
  if (n === 1015) return 1;
  if (n >= 1014 && n <= 1022) return 0;
  if (n >= 1023 && n <= 1034) return 1;
  if (n >= 1036 && n <= 1048) return 2;
  if (n >= 1049 && n <= 1061) return 3;
  if (n >= 1062 && n <= 1074) return 4;
  if (n >= 1075 && n <= 1084) return 5;
  if (n >= 1085 && n <= 1093) return 6;
  if (n >= 1094 && n <= 1102) return 7;
  if (n >= 1103 && n <= 1109) return 8;
  if (n >= 1110 && n <= 1116) return 9;
  return null;
}

/** Very light text-mode extraction for non-fillable PDFs. */
function fieldsFromText(text: string): Fields {
  const f: Fields = {};
  const grab = (re: RegExp, key: string) => {
    const m = text.match(re);
    if (m?.[1]) f[norm(key)] = m[1].trim();
  };
  grab(/character\s*name[:\s]+([A-Z][\w'’\- ]{2,40})/i, "CharacterName");
  grab(/class\s*(?:&|and)?\s*level[:\s]+([\w' \-\/]{3,40})/i, "ClassLevel");
  grab(/\brace[:\s]+([\w' \-]{3,30})/i, "Race");
  grab(/background[:\s]+([\w' \-]{3,30})/i, "Background");
  grab(/alignment[:\s]+([\w' \-]{3,30})/i, "Alignment");
  grab(/player\s*name[:\s]+([\w' \-\.]{2,40})/i, "PlayerName");
  grab(/armor\s*class[:\s]*(\d{1,2})/i, "AC");
  grab(/\bspeed[:\s]*(\d{1,3})/i, "Speed");
  grab(/(?:hit\s*point\s*maximum|max\s*hp)[:\s]*(\d{1,3})/i, "HPMax");
  for (const a of ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]) {
    grab(new RegExp(`${a}[^0-9]{0,20}(\\d{1,2})`, "i"), a.slice(0, 3).toUpperCase());
  }
  return f;
}

/**
 * Parses the PDF then writes everything into the character's records.
 * Existing rows for the character are replaced for the sections found.
 */
export async function importCharacterPdf(file: File, character: Character): Promise<ImportReport> {
  const bytes = await file.arrayBuffer();
  let fields = await readFormFields(bytes);
  let mode: ImportReport["mode"] = "form";
  if (Object.keys(fields).length < 4) {
    mode = "text";
    fields = fieldsFromText(await readText(bytes));
  }

  const applied: string[] = [];
  const missing: string[] = [];
  const track = (label: string, ok: boolean) => { (ok ? applied : missing).push(label); };

  const id = character.id;
  const f = fields;

  // ---- Cover / identity ----
  const name = pick(f, "CharacterName", "CharacterName 2");
  const classLevel = pick(f, "ClassLevel");
  const race = pick(f, "Race ", "Race");
  const background = pick(f, "Background");
  const alignment = pick(f, "Alignment");
  const playerName = pick(f, "PlayerName");
  const quote = pick(f, "CharacterQuote", "Allies", "FactionName");

  const level = parseLevel(classLevel) || parseLevel(character.class_level) || 1;

  const charPatch: Record<string, any> = {};
  const set = (k: string, v: any, label: string, keep = false) => {
    const empty = v === "" || v === null || v === undefined;
    if (!empty) charPatch[k] = v;
    if (!keep) track(label, !empty);
  };

  set("name", name, "Character name");
  set("class_level", classLevel, "Class & level");
  set("race", race, "Race");
  set("background", background, "Background");
  set("alignment", alignment, "Alignment");
  set("player_name", playerName, "Player name");
  set("character_quote", quote, "Character quote");
  set("armor_class", num(pick(f, "AC"), 0) || "", "Armor class");
  set("speed", num(pick(f, "Speed"), 0) || "", "Speed");
  set("hp_max", num(pick(f, "HPMax"), 0) || "", "Hit points");
  const hpCur = num(pick(f, "HPCurrent"), 0);
  if (hpCur) charPatch.hp_current = hpCur;
  else if (charPatch.hp_max) charPatch.hp_current = charPatch.hp_max;
  set("hit_dice", pick(f, "HD", "HDTotal"), "Hit dice");
  set("initiative", num(pick(f, "Initiative"), 0) || "", "Initiative");
  set("passive_perception", num(pick(f, "Passive"), 0) || "", "Passive perception");
  charPatch.proficiency_bonus = num(pick(f, "ProfBonus"), 0) || profBonusForLevel(level);
  set("languages", pick(f, "ProficienciesLang"), "Languages & proficiencies");
  set("backstory", pick(f, "Backstory"), "Backstory");
  set("combat_notes", pick(f, "AttacksSpellcasting"), "Combat notes");
  set("racial_traits", pick(f, "Features and Traits"), "Features & traits");
  set("feats", pick(f, "Feat+Traits", "FeaturesTraits"), "Feats");
  set("magic_items", pick(f, "Treasure"), "Treasure / magic items");
  const dsSucc = ["Check Box 12", "Check Box 13", "Check Box 14"].filter((k) => pick(f, k) === "on").length;
  const dsFail = ["Check Box 15", "Check Box 16", "Check Box 17"].filter((k) => pick(f, k) === "on").length;
  if (dsSucc) charPatch.death_save_successes = dsSucc;
  if (dsFail) charPatch.death_save_failures = dsFail;

  if (Object.keys(charPatch).length) await db.from("characters").update(charPatch).eq("id", id);

  // ---- Ability scores ----
  const abilityMap: Record<string, string> = {
    strength: "STR", dexterity: "DEX", constitution: "CON",
    intelligence: "INT", wisdom: "WIS", charisma: "CHA",
  };
  const scores: Record<string, number> = {};
  let anyScore = false;
  for (const [col, key] of Object.entries(abilityMap)) {
    const v = num(pick(f, key), 0);
    scores[col] = v || 10;
    if (v) anyScore = true;
  }
  track("Ability scores", anyScore);
  if (anyScore) {
    const existing = (await db.from("ability_scores").select("id").eq("character_id", id).maybeSingle()).data;
    if (existing) await db.from("ability_scores").update(scores).eq("character_id", id);
    else await db.from("ability_scores").insert({ character_id: id, ...scores });
  }

  // ---- Saves & skills ----
  const skillFieldNames: Record<string, string[]> = {
    Acrobatics: ["Acrobatics"], "Animal Handling": ["Animal"], Arcana: ["Arcana"], Athletics: ["Athletics"],
    Deception: ["Deception "], History: ["History "], Insight: ["Insight"], Intimidation: ["Intimidation"],
    Investigation: ["Investigation "], Medicine: ["Medicine"], Nature: ["Nature"], Perception: ["Perception "],
    Performance: ["Performance"], Persuasion: ["Persuasion"], Religion: ["Religion"],
    "Sleight of Hand": ["SleightofHand"], Stealth: ["Stealth "], Survival: ["Survival"],
  };
  const rows: any[] = [];
  let anySkill = false;
  for (const s of SAVE_LIST) {
    const raw = pick(f, `ST ${s.name}`);
    if (raw) anySkill = true;
    rows.push({ character_id: id, name: s.name, kind: "save", modifier: num(raw, 0), proficient: /^\+/.test(raw) && num(raw, 0) > 0 });
  }
  for (const s of SKILL_LIST) {
    const raw = pick(f, ...(skillFieldNames[s.name] ?? [s.name]));
    if (raw) anySkill = true;
    rows.push({ character_id: id, name: s.name, kind: "skill", modifier: num(raw, 0), proficient: false });
  }
  track("Saving throws & skills", anySkill);
  if (anySkill) {
    await db.from("skills").delete().eq("character_id", id);
    await db.from("skills").insert(rows);
  }

  // ---- Attacks ----
  const attacks: any[] = [];
  const weaponSets: [string[], string[], string[]][] = [
    [["Wpn Name"], ["Wpn1 AttackBonus", "Wpn1 AttackBonus "], ["Wpn1 Damage"]],
    [["Wpn Name 2"], ["Wpn2 AttackBonus ", "Wpn2 AttackBonus"], ["Wpn2 Damage "]],
    [["Wpn Name 3"], ["Wpn3 AttackBonus  ", "Wpn3 AttackBonus"], ["Wpn3 Damage "]],
  ];
  for (const [n, b, d] of weaponSets) {
    const wn = pick(f, ...n);
    if (!wn) continue;
    const dmg = pick(f, ...d);
    attacks.push({
      character_id: id, weapon_name: wn, attack_bonus: pick(f, ...b),
      damage_dice: dmg.replace(/\s*(slashing|piercing|bludgeoning|fire|cold|radiant|necrotic|force|thunder|acid|poison|psychic|lightning).*/i, "").trim() || dmg,
      damage_type: (dmg.match(/(slashing|piercing|bludgeoning|fire|cold|radiant|necrotic|force|thunder|acid|poison|psychic|lightning)/i)?.[1] ?? ""),
    });
  }
  track("Weapons & attacks", attacks.length > 0);
  if (attacks.length) {
    await db.from("attacks").delete().eq("character_id", id);
    await db.from("attacks").insert(attacks);
  }

  // ---- Currency ----
  const coin = { cp: num(pick(f, "CP")), sp: num(pick(f, "SP")), ep: num(pick(f, "EP")), gp: num(pick(f, "GP")), pp: num(pick(f, "PP")) };
  const anyCoin = Object.values(coin).some((v) => v > 0);
  track("Coin purse", anyCoin);
  if (anyCoin) {
    const existing = (await db.from("currency").select("id").eq("character_id", id).maybeSingle()).data;
    if (existing) await db.from("currency").update(coin).eq("character_id", id);
    else await db.from("currency").insert({ character_id: id, ...coin });
  }

  // ---- Equipment ----
  const equipRaw = pick(f, "Equipment");
  const equipLines = equipRaw
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
    .slice(0, 60);
  track("Equipment", equipLines.length > 0);
  if (equipLines.length) {
    await db.from("equipment").delete().eq("character_id", id);
    await db.from("equipment").insert(
      equipLines.map((line) => {
        const m = line.match(/^(?:(\d+)\s*x?\s*)?(.+?)(?:\s*x\s*(\d+))?$/i);
        const qty = parseInt(m?.[1] ?? m?.[3] ?? "1", 10) || 1;
        return { character_id: id, name: (m?.[2] ?? line).trim(), quantity: qty, emoji_icon: "" };
      }),
    );
  }

  // ---- Traits ----
  const traits = {
    personality: pick(f, "PersonalityTraits ", "PersonalityTraits"),
    ideal: pick(f, "Ideals"),
    bond: pick(f, "Bonds"),
    flaw: pick(f, "Flaws"),
  };
  const anyTrait = Object.values(traits).some(Boolean);
  track("Personality, ideals, bonds & flaws", anyTrait);
  if (anyTrait) {
    const existing = (await db.from("traits").select("id").eq("character_id", id).maybeSingle()).data;
    if (existing) await db.from("traits").update(traits).eq("character_id", id);
    else await db.from("traits").insert({ character_id: id, ...traits });
  }

  // ---- Spells ----
  const spellRows: any[] = [];
  for (const key of Object.keys(f)) {
    const m = key.match(/^spells(\d{4})$/);
    if (!m) continue;
    const lvl = spellFieldLevel(parseInt(m[1], 10));
    if (lvl === null) continue;
    const value = f[key];
    if (!value || value.length < 2) continue;
    spellRows.push({
      character_id: id, spell_level: lvl, name: value.slice(0, 120),
      school: "", casting_time: "", range: "", components: "", duration: "",
      description: "", upcast_note: "",
    });
  }
  track("Spell list", spellRows.length > 0);
  if (spellRows.length) {
    await db.from("spells").delete().eq("character_id", id);
    await db.from("spells").insert(spellRows);
  }

  const spellAbility = pick(f, "Spellcasting Ability 2", "SpellcastingAbility 2", "Spellcasting Class 2");
  const dc = num(pick(f, "SpellSaveDC  2", "SpellSaveDC 2", "SpellSaveDC"), 0);
  const atk = num(pick(f, "SpellAtkBonus 2", "SpellAtkBonus"), 0);
  if (spellAbility || dc || atk) {
    const meta = { spellcasting_ability: spellAbility, spell_save_dc: dc, spell_attack_bonus: atk };
    const existing = (await db.from("spell_meta").select("id").eq("character_id", id).maybeSingle()).data;
    if (existing) await db.from("spell_meta").update(meta).eq("character_id", id);
    else await db.from("spell_meta").insert({ character_id: id, ...meta });
    applied.push("Spellcasting stats");
  } else {
    missing.push("Spellcasting stats");
  }

  return { fieldsFound: Object.keys(f).length, applied, missing, mode };
}
