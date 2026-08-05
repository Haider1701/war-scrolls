import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type {
  Abilities, Attack, Character, Currency, Equipment, FreeNotes, Session, Skill, Spell, SpellMeta, Traits,
} from "../types";
import { abilityMod, fmtMod, formatMulticlass, totalLevel } from "../types";
import { pdfPalette, type PdfPalette } from "./palette";

export type SheetData = {
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
};

function makeStyles(p: PdfPalette) {
  return StyleSheet.create({
    page: { backgroundColor: p.bg, color: p.ink, padding: 28, fontSize: 9, fontFamily: "Times-Roman" },
    h1: { fontSize: 20, color: p.accent2, fontFamily: "Times-Bold", marginBottom: 2 },
    sub: { fontSize: 9, color: p.muted, marginBottom: 10 },
    sectionTitle: { fontSize: 11, color: p.accent, fontFamily: "Times-Bold", marginBottom: 4, marginTop: 8 },
    card: { backgroundColor: p.panel, borderWidth: 1, borderColor: p.border, borderRadius: 4, padding: 8, marginBottom: 6 },
    row: { flexDirection: "row", flexWrap: "wrap" },
    col: { flexGrow: 1, flexBasis: "50%", paddingRight: 6 },
    kv: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
    label: { color: p.muted },
    val: { color: p.ink },
    statBox: { width: "16%", margin: "0.5%", borderWidth: 1, borderColor: p.border, borderRadius: 4, padding: 4, alignItems: "center", backgroundColor: p.panel },
    statName: { fontSize: 6, color: p.muted, textTransform: "uppercase" },
    statScore: { fontSize: 13, color: p.accent2, fontFamily: "Times-Bold" },
    statMod: { fontSize: 8, color: p.ink },
    portrait: { width: 78, height: 96, objectFit: "cover", borderRadius: 4, marginRight: 10 },
    tag: { fontSize: 7, color: p.bg, backgroundColor: p.accent, borderRadius: 2, paddingHorizontal: 3, paddingVertical: 1, marginRight: 3 },
    spellName: { color: p.accent2, fontFamily: "Times-Bold", fontSize: 10 },
    footer: { position: "absolute", bottom: 14, left: 28, right: 28, fontSize: 7, color: p.muted, textAlign: "center" },
    hr: { borderBottomWidth: 1, borderBottomColor: p.border, marginVertical: 4, opacity: 0.5 },
    p: { lineHeight: 1.5, marginBottom: 4 },
  });
}

const ABIL: { key: keyof Abilities; label: string }[] = [
  { key: "strength", label: "Str" }, { key: "dexterity", label: "Dex" }, { key: "constitution", label: "Con" },
  { key: "intelligence", label: "Int" }, { key: "wisdom", label: "Wis" }, { key: "charisma", label: "Cha" },
];

function KV({ s, k, v }: { s: any; k: string; v: React.ReactNode }) {
  return (
    <View style={s.kv}>
      <Text style={s.label}>{k}</Text>
      <Text style={s.val}>{v || "—"}</Text>
    </View>
  );
}

export function CharacterSheetPdf({ data }: { data: SheetData }) {
  const c = data.character;
  const p = pdfPalette(c.theme, c.custom_theme);
  const s = makeStyles(p);
  const lvl = totalLevel(c);
  const saves = data.skills.filter((k) => k.kind === "save");
  const skills = data.skills.filter((k) => k.kind !== "save");
  const byLevel = new Map<number, Spell[]>();
  data.spells.forEach((sp) => {
    const arr = byLevel.get(sp.spell_level) ?? [];
    arr.push(sp);
    byLevel.set(sp.spell_level, arr);
  });
  const spellLevels = [...byLevel.keys()].sort((a, b) => a - b);
  const money = data.currency;

  return (
    <Document title={`${c.name || "Character"} — Journal Sheet`} author="Ember Codex">
      {/* PAGE 1 — MAIN SHEET */}
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: "row", marginBottom: 6 }}>
          {c.image_url ? <Image src={c.image_url} style={s.portrait} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={s.h1}>{c.name || "Unnamed"}</Text>
            <Text style={s.sub}>{c.subtitle || formatMulticlass(c.class_level, c.class_level_2) || "Adventurer"}</Text>
            <View style={s.row}>
              <View style={s.col}>
                <KV s={s} k="Class" v={formatMulticlass(c.class_level, c.class_level_2)} />
                <KV s={s} k="Race" v={c.race} />
                <KV s={s} k="Background" v={c.background} />
              </View>
              <View style={s.col}>
                <KV s={s} k="Alignment" v={c.alignment} />
                <KV s={s} k="Total Level" v={lvl || "—"} />
                <KV s={s} k="Proficiency" v={fmtMod(c.proficiency_bonus ?? 2)} />
              </View>
            </View>
          </View>
        </View>

        <View style={s.card}>
          <View style={s.row}>
            <View style={s.col}><KV s={s} k="Hit Points" v={`${c.hp_current ?? 0} / ${c.hp_max ?? 0}`} /></View>
            <View style={s.col}><KV s={s} k="Armor Class" v={c.armor_class ?? "—"} /></View>
            <View style={s.col}><KV s={s} k="Speed" v={c.speed ? `${c.speed} ft` : "—"} /></View>
            <View style={s.col}><KV s={s} k="Passive Perception" v={c.passive_perception ?? "—"} /></View>
          </View>
          {c.affliction_note ? <Text style={{ color: p.blood, marginTop: 3 }}>⚠ {c.affliction_note}</Text> : null}
        </View>

        <Text style={s.sectionTitle}>Ability Scores</Text>
        <View style={s.row}>
          {ABIL.map((a) => {
            const score = (data.abilities?.[a.key] as number) ?? 10;
            return (
              <View key={a.label} style={s.statBox}>
                <Text style={s.statName}>{a.label}</Text>
                <Text style={s.statScore}>{score}</Text>
                <Text style={s.statMod}>{fmtMod(abilityMod(score))}</Text>
              </View>
            );
          })}
        </View>

        <View style={s.row}>
          <View style={{ flexBasis: "50%", paddingRight: 5 }}>
            <Text style={s.sectionTitle}>Saving Throws</Text>
            <View style={s.card}>
              {saves.length === 0 ? <Text style={s.label}>None recorded</Text> : saves.map((k) => (
                <KV key={k.id} s={s} k={`${k.proficient ? "●" : "○"} ${k.name}`} v={fmtMod(k.modifier ?? 0)} />
              ))}
            </View>
            <Text style={s.sectionTitle}>Attacks</Text>
            <View style={s.card}>
              {data.attacks.length === 0 ? <Text style={s.label}>None recorded</Text> : data.attacks.map((a) => (
                <View key={a.id} style={{ marginBottom: 3 }}>
                  <Text style={{ color: p.accent2 }}>{a.weapon_name || "Weapon"}</Text>
                  <Text style={s.label}>{[a.attack_bonus, a.damage_dice, a.damage_type].filter(Boolean).join(" · ") || "—"}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ flexBasis: "50%" }}>
            <Text style={s.sectionTitle}>Skills</Text>
            <View style={s.card}>
              {skills.length === 0 ? <Text style={s.label}>None recorded</Text> : skills.map((k) => (
                <KV key={k.id} s={s} k={`${k.proficient ? "●" : "○"} ${k.name}`} v={fmtMod(k.modifier ?? 0)} />
              ))}
            </View>
          </View>
        </View>

        <Text style={s.sectionTitle}>Proficiencies, Languages & Coin</Text>
        <View style={s.card}>
          <KV s={s} k="Languages" v={c.languages} />
          <KV s={s} k="Armor" v={c.armor_prof} />
          <KV s={s} k="Weapons" v={c.weapons_prof} />
          <KV s={s} k="Tools" v={c.tools_prof} />
          <View style={s.hr} />
          <KV s={s} k="Coin" v={money ? `${money.pp ?? 0} pp · ${money.gp ?? 0} gp · ${money.ep ?? 0} ep · ${money.sp ?? 0} sp · ${money.cp ?? 0} cp` : "—"} />
        </View>

        <Text style={s.sectionTitle}>Equipment</Text>
        <View style={s.card}>
          {data.equipment.length === 0 ? <Text style={s.label}>Empty pack</Text> : (
            <Text style={s.p}>
              {data.equipment.map((e) => `${e.emoji_icon ? e.emoji_icon + " " : ""}${e.name}${e.quantity > 1 ? ` ×${e.quantity}` : ""}`).join(" · ")}
            </Text>
          )}
        </View>

        <Text style={s.footer}>{c.name || "Unnamed"} · Page 1 of 3 · Main Sheet</Text>
      </Page>

      {/* PAGE 2 — SPELLS */}
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Spellbook</Text>
        <Text style={s.sub}>{c.name || "Unnamed"} · {formatMulticlass(c.class_level, c.class_level_2) || "—"}</Text>

        <View style={s.card}>
          <View style={s.row}>
            <View style={s.col}><KV s={s} k="Spellcasting Ability" v={data.spellMeta?.spellcasting_ability} /></View>
            <View style={s.col}><KV s={s} k="Spell Save DC" v={data.spellMeta?.spell_save_dc} /></View>
            <View style={s.col}><KV s={s} k="Spell Attack" v={data.spellMeta ? fmtMod(data.spellMeta.spell_attack_bonus ?? 0) : "—"} /></View>
          </View>
          {data.spellMeta?.slot_counts ? (
            <Text style={{ marginTop: 3, color: p.muted }}>
              Slots: {Object.entries(data.spellMeta.slot_counts)
                .filter(([, n]) => Number(n) > 0)
                .map(([l, n]) => `L${l}: ${Number(data.spellMeta?.slots_used?.[l] ?? 0)}/${n}`)
                .join("  ") || "—"}
            </Text>
          ) : null}
        </View>

        {spellLevels.length === 0 ? <Text style={s.label}>No spells inscribed.</Text> : spellLevels.map((lv) => (
          <View key={lv} wrap={false}>
            <Text style={s.sectionTitle}>{lv === 0 ? "Cantrips" : `Level ${lv}`}</Text>
            {(byLevel.get(lv) ?? []).map((sp) => (
              <View key={sp.id} style={s.card}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={s.spellName}>{sp.name || "Unnamed Spell"}</Text>
                  {sp.is_homebrew ? <Text style={{ ...s.tag, marginLeft: 4 }}>{sp.gm_approved ? "HOMEBREW ✓" : sp.gm_denied ? "HOMEBREW ✕" : "HOMEBREW ?"}</Text> : null}
                </View>
                <Text style={s.label}>
                  {[sp.school, sp.casting_time, sp.range, sp.components, sp.duration].filter(Boolean).join(" · ")}
                </Text>
                {sp.description ? <Text style={{ ...s.p, marginTop: 3 }}>{sp.description}</Text> : null}
                {sp.upcast_note ? <Text style={{ color: p.accent2 }}>At Higher Levels: {sp.upcast_note}</Text> : null}
              </View>
            ))}
          </View>
        ))}

        <Text style={s.footer}>{c.name || "Unnamed"} · Page 2 of 3 · Spellbook</Text>
      </Page>

      {/* PAGE 3 — NOTES / BACKSTORY / SESSIONS */}
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Chronicle & Notes</Text>
        <Text style={s.sub}>{c.name || "Unnamed"}</Text>

        <Text style={s.sectionTitle}>Traits</Text>
        <View style={s.card}>
          <KV s={s} k="Personality" v={data.traits?.personality} />
          <KV s={s} k="Ideal" v={data.traits?.ideal} />
          <KV s={s} k="Bond" v={data.traits?.bond} />
          <KV s={s} k="Flaw" v={data.traits?.flaw} />
        </View>

        <Text style={s.sectionTitle}>Backstory</Text>
        <View style={s.card}>
          <Text style={s.p}>{c.backstory || "Unwritten."}</Text>
        </View>

        {(c.features ?? []).length > 0 ? (
          <>
            <Text style={s.sectionTitle}>Features & Traits</Text>
            <View style={s.card}>
              {(c.features ?? []).map((f, i) => (
                <View key={i} style={{ marginBottom: 4 }}>
                  <Text style={{ color: p.accent2 }}>{f.title}</Text>
                  <Text style={s.p}>{f.description}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={s.sectionTitle}>Session Log</Text>
        {data.sessions.length === 0 ? <Text style={s.label}>No sessions recorded.</Text> : data.sessions.map((sn) => (
          <View key={sn.id} style={s.card} wrap={false}>
            <Text style={{ color: p.accent2 }}>Session {sn.session_number}{sn.title ? ` — ${sn.title}` : ""}{sn.date_played ? `  (${sn.date_played})` : ""}</Text>
            {(sn.notes ?? []).map((n, i) => <Text key={i} style={s.p}>• {n}</Text>)}
            {sn.encounter_notes ? <Text style={s.label}>Encounters: {sn.encounter_notes}</Text> : null}
          </View>
        ))}

        <Text style={s.sectionTitle}>Free Notes</Text>
        <View style={s.card}>
          <Text style={s.p}>{data.notes?.content || "Blank pages await."}</Text>
        </View>

        <Text style={s.footer}>{c.name || "Unnamed"} · Page 3 of 3 · Chronicle</Text>
      </Page>
    </Document>
  );
}
