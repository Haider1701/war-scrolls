import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type {
  Abilities, Attack, Character, CharacterImage, Currency, Equipment, FreeNotes,
  NPC, Session, Skill, Spell, SpellMeta, Traits,
} from "../types";
import { abilityMod, fmtMod, formatMulticlass, totalLevel } from "../types";
import { pdfPalette, type PdfPalette } from "./palette";
import { fallbackFonts, type PdfFonts } from "./fonts";

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
  npcs: NPC[];
  images: CharacterImage[];
  /** Optional provenance line appended to every page footer (e.g. DM export note). */
  exportNote?: string;
  fonts?: PdfFonts;
  /** When true, only Page 1 (Cover) and Page 3 (Stats) are rendered. */
  mainOnly?: boolean;
};

const APP_NAME = "Ember Codex";

function makeStyles(p: PdfPalette, f: PdfFonts) {
  const head = f.heading;
  const body = f.body;
  return StyleSheet.create({
    page: { backgroundColor: p.bg, color: p.ink, paddingTop: 26, paddingBottom: 34, paddingHorizontal: 26, fontSize: 8.5, fontFamily: body },
    wash: { position: "absolute", top: 0, left: 0, right: 0, height: 300, backgroundColor: p.panel, opacity: 0.45 },
    washBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 220, backgroundColor: p.panel, opacity: 0.3 },
    frameOuter: { position: "absolute", top: 12, left: 12, right: 12, bottom: 12, borderWidth: 1, borderColor: p.accent, borderRadius: 10, opacity: 0.55 },
    frameInner: { position: "absolute", top: 17, left: 17, right: 17, bottom: 17, borderWidth: 0.5, borderColor: p.accent2, borderRadius: 8, opacity: 0.4 },

    title: { fontSize: 34, color: p.accent2, fontFamily: head, textAlign: "center", marginTop: 12 },
    titleSm: { fontSize: 18, color: p.accent2, fontFamily: head },
    subtitle: { fontSize: 10, color: p.muted, textAlign: "center", marginTop: 4, fontStyle: "italic" },

    sectionTitle: { fontSize: 11, color: p.accent, fontFamily: head, marginBottom: 3, marginTop: 6, borderBottomWidth: 1, borderBottomColor: p.accent, paddingBottom: 2 },
    label: { color: p.muted, fontSize: 7.5 },
    val: { color: p.ink },

    card: { backgroundColor: p.panel, borderWidth: 0.6, borderColor: p.border, borderRadius: 8, padding: 6, marginBottom: 5 },
    row: { flexDirection: "row" },

    infoBox: { flex: 1, marginHorizontal: 3, backgroundColor: p.panel, borderWidth: 0.8, borderColor: p.border, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 5, alignItems: "center" },
    infoLabel: { fontSize: 6.5, color: p.accent, letterSpacing: 1, marginBottom: 3 },
    infoVal: { fontSize: 10, color: p.ink, fontFamily: head, textAlign: "center" },

    bubbleWrap: { width: 84, alignItems: "center" },
    bubbleOuter: { width: 66, height: 66, borderRadius: 33, borderWidth: 1.4, borderColor: p.accent, alignItems: "center", justifyContent: "center", backgroundColor: p.panel },
    bubbleInner: { width: 54, height: 54, borderRadius: 27, borderWidth: 0.7, borderColor: p.accent2, alignItems: "center", justifyContent: "center" },
    bubbleVal: { fontSize: 14, color: p.accent2, fontFamily: head },
    bubbleName: { fontSize: 6, color: p.muted, marginTop: 3, textAlign: "center" },

    traitCard: { width: "48%", margin: "1%", backgroundColor: p.panel, borderLeftWidth: 3, borderRadius: 8, padding: 6 },
    traitName: { fontSize: 7, color: p.accent, letterSpacing: 1, marginBottom: 2 },

    abilBox: { borderWidth: 0.7, borderColor: p.border, borderRadius: 8, marginBottom: 5, overflow: "hidden", backgroundColor: p.panel },
    abilTag: { backgroundColor: p.accent, color: p.bg, fontSize: 6.5, textAlign: "center", paddingVertical: 1.5, letterSpacing: 1 },
    abilMod: { fontSize: 15, color: p.accent2, textAlign: "center", fontFamily: head, marginTop: 2 },
    abilScore: { fontSize: 6.5, color: p.muted, textAlign: "center", marginBottom: 3 },

    dotOn: { width: 4, height: 4, borderRadius: 2, backgroundColor: p.accent, marginRight: 3, marginTop: 2 },
    dotOff: { width: 4, height: 4, borderRadius: 2, borderWidth: 0.5, borderColor: p.muted, marginRight: 3, marginTop: 2 },
    skillRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 1.6 },

    coin: { width: 30, height: 30, borderRadius: 15, borderWidth: 0.8, borderColor: p.border, alignItems: "center", justifyContent: "center", marginRight: 3, backgroundColor: p.panel },
    coinGp: { borderWidth: 1.4, borderColor: p.accent2 },

    spellCard: { backgroundColor: p.panel, borderLeftWidth: 3, borderLeftColor: p.accent, borderRadius: 8, padding: 6, marginBottom: 5 },
    spellName: { color: p.accent2, fontSize: 9.5, fontFamily: head },

    sessionHead: { backgroundColor: p.panel, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 5, marginBottom: 3, borderWidth: 0.5, borderColor: p.border },
    ruled: { borderBottomWidth: 0.5, borderBottomColor: p.border, opacity: 0.5, height: 10 },

    npcCard: { width: "31.3%", margin: "1%", backgroundColor: p.panel, borderWidth: 0.6, borderColor: p.border, borderRadius: 8, padding: 5 },
    badge: { fontSize: 6, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, alignSelf: "flex-start", marginTop: 2, color: p.bg },

    p: { lineHeight: 1.45, marginBottom: 3 },
    footer: { position: "absolute", bottom: 14, left: 26, right: 26, fontSize: 6.5, color: p.muted, textAlign: "center" },
  });
}

const ABIL: { key: keyof Abilities; label: string }[] = [
  { key: "strength", label: "STRENGTH" }, { key: "dexterity", label: "DEXTERITY" }, { key: "constitution", label: "CONSTITUTION" },
  { key: "intelligence", label: "INTELLIGENCE" }, { key: "wisdom", label: "WISDOM" }, { key: "charisma", label: "CHARISMA" },
];

function Divider({ p }: { p: PdfPalette }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 7 }}>
      <View style={{ flex: 1, height: 0.7, backgroundColor: p.accent, opacity: 0.6 }} />
      <View style={{ width: 7, height: 7, backgroundColor: p.accent2, marginHorizontal: 6, transform: "rotate(45deg)" }} />
      <View style={{ flex: 1, height: 0.7, backgroundColor: p.accent, opacity: 0.6 }} />
    </View>
  );
}

function Corner({ p, pos }: { p: PdfPalette; pos: [string, string] }) {
  const [v, h] = pos;
  const base: any = { position: "absolute", width: 26, height: 26, borderColor: p.accent2 };
  base[v] = 4; base[h] = 4;
  if (v === "top") base.borderTopWidth = 2; else base.borderBottomWidth = 2;
  if (h === "left") base.borderLeftWidth = 2; else base.borderRightWidth = 2;
  return <View style={base} />;
}

function Footer({ s, name, page, chapter, note }: { s: any; name: string; page: number; chapter: string; note?: string }) {
  return (
    <Text style={s.footer} fixed>
      {name} · Page {page} of 4 · {chapter} · {APP_NAME}{note ? ` · ${note}` : ""}
    </Text>
  );
}

const dispColor = (d: string, p: PdfPalette) =>
  d === "ally" ? "#4caf50" : d === "neutral" ? p.accent2 : p.blood;

export function CharacterSheetPdf({ data }: { data: SheetData }) {
  const c = data.character;
  const p = pdfPalette(c.theme, c.custom_theme);
  const f = data.fonts ?? fallbackFonts;
  const s = makeStyles(p, f);
  const lvl = totalLevel(c);
  const saves = data.skills.filter((k) => k.kind === "save");
  const skills = data.skills.filter((k) => k.kind !== "save");
  const cantrips = data.spells.filter((sp) => sp.spell_level === 0);
  const leveled = data.spells.filter((sp) => sp.spell_level > 0);
  const money = data.currency;
  const primary = data.images.find((i) => i.is_primary)?.image_url || c.image_url || "";
  const gallery = data.images.filter((i) => i.image_url && i.image_url !== primary).slice(0, 6);
  const classLine = formatMulticlass(c.class_level, c.class_level_2);
  const note = data.exportNote;
  const half = Math.ceil(skills.length / 2);

  const bubbles: [string, string][] = [
    [`${c.hp_current ?? 0}/${c.hp_max ?? 0}`, "HIT POINTS"],
    [String(c.armor_class ?? "—"), "ARMOR CLASS"],
    [c.speed ? `${c.speed}` : "—", "SPEED (FT)"],
    [fmtMod(c.initiative ?? 0), "INITIATIVE"],
    [fmtMod(c.proficiency_bonus ?? 2), "PROFICIENCY"],
    [String(c.passive_perception ?? "—"), "PASSIVE PERC."],
  ];

  const traitCards: [string, string, string][] = [
    ["PERSONALITY", data.traits?.personality || "—", p.accent],
    ["IDEAL", data.traits?.ideal || "—", p.accent2],
    ["BOND", data.traits?.bond || "—", "#4caf50"],
    ["FLAW", data.traits?.flaw || "—", p.blood],
  ];

  const CoverPage = (
    <Page size="A4" style={s.page}>
      <View style={s.wash} fixed />
      <View style={s.frameOuter} fixed />
      <View style={s.frameInner} fixed />
      <Corner p={p} pos={["top", "left"]} />
      <Corner p={p} pos={["top", "right"]} />
      <Corner p={p} pos={["bottom", "left"]} />
      <Corner p={p} pos={["bottom", "right"]} />

      <Text style={s.title}>{c.name || "Unnamed"}</Text>
      <Text style={s.subtitle}>{c.subtitle || c.character_quote || classLine || "Adventurer"}</Text>
      <Divider p={p} />

      <View style={s.row}>
        <View style={s.infoBox}>
          <Text style={s.infoLabel}>CLASS &amp; LEVEL</Text>
          <Text style={s.infoVal}>{classLine || "—"}{lvl ? `  (Lv ${lvl})` : ""}</Text>
        </View>
        <View style={s.infoBox}><Text style={s.infoLabel}>RACE</Text><Text style={s.infoVal}>{c.race || "—"}</Text></View>
        <View style={s.infoBox}><Text style={s.infoLabel}>BACKGROUND</Text><Text style={s.infoVal}>{c.background || "—"}</Text></View>
        <View style={s.infoBox}><Text style={s.infoLabel}>ALIGNMENT</Text><Text style={s.infoVal}>{c.alignment || "—"}</Text></View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", flexWrap: "wrap", marginTop: 14 }}>
        {bubbles.map(([v, k]) => (
          <View key={k} style={s.bubbleWrap}>
            <View style={s.bubbleOuter}>
              <View style={s.bubbleInner}><Text style={s.bubbleVal}>{v}</Text></View>
            </View>
            <Text style={s.bubbleName}>{k}</Text>
          </View>
        ))}
      </View>

      {c.affliction_note ? (
        <View style={{ borderWidth: 1, borderColor: p.blood, borderRadius: 8, padding: 6, marginTop: 12 }}>
          <Text style={{ color: p.blood }}>{c.affliction_note}</Text>
        </View>
      ) : null}

      <Divider p={p} />
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {traitCards.map(([k, v, col]) => (
          <View key={k} style={{ ...s.traitCard, borderLeftColor: col }}>
            <Text style={s.traitName}>{k}</Text>
            <Text style={s.p}>{v}</Text>
          </View>
        ))}
      </View>

      <Divider p={p} />
      <Text style={s.sectionTitle}>From the Chronicle</Text>
      <Text style={{ ...s.p, fontStyle: "italic", textAlign: "justify" }}>
        {(c.backstory || "This tale is yet unwritten.").slice(0, 400)}
        {(c.backstory || "").length > 400 ? "…" : ""}
      </Text>

      <Footer s={s} name={c.name || "Unnamed"} page={1} chapter="Cover" note={note} />
    </Page>
  );

  const PortraitPage = (
    <Page size="A4" style={s.page}>
      <View style={s.wash} fixed />
      <Text style={{ ...s.sectionTitle, textAlign: "center", letterSpacing: 2 }}>CHARACTER PORTRAIT</Text>
      <View style={{ flex: 1, marginTop: 6, borderWidth: 1.4, borderColor: p.accent, borderRadius: 12, padding: 6 }}>
        <View style={{ flex: 1, borderWidth: 0.7, borderColor: p.accent2, borderRadius: 8, position: "relative", overflow: "hidden", backgroundColor: p.panel }}>
          {primary ? (
            <Image src={primary} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 40, color: p.accent }}>❖</Text>
              <Text style={{ ...s.title, marginTop: 6 }}>{c.name || "Unnamed"}</Text>
              <Text style={s.subtitle}>No portrait committed to these pages</Text>
              <Text style={{ fontSize: 26, color: p.accent2, marginTop: 8 }}>✶ ❦ ✶</Text>
            </View>
          )}
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: p.bg, opacity: 0.82, paddingVertical: 8, paddingHorizontal: 10 }} />
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingVertical: 8, paddingHorizontal: 10 }}>
            <Text style={{ ...s.titleSm, color: p.accent2 }}>{c.name || "Unnamed"}</Text>
            <Text style={s.label}>{classLine || "Adventurer"}{c.race ? ` · ${c.race}` : ""}</Text>
          </View>
          <Corner p={p} pos={["top", "left"]} />
          <Corner p={p} pos={["top", "right"]} />
        </View>
      </View>
      <Footer s={s} name={c.name || "Unnamed"} page={2} chapter="Portrait" note={note} />
    </Page>
  );

  const StatsPage = (
    <Page size="A4" style={s.page}>
      <View style={s.wash} fixed />
      <Text style={s.titleSm}>{c.name || "Unnamed"}</Text>
      <Text style={s.label}>{[classLine, c.race, c.background].filter(Boolean).join(" · ") || "—"}</Text>
      <Divider p={p} />

      <View style={s.row}>
        {/* LEFT — abilities + saves */}
        <View style={{ width: "27%", paddingRight: 6 }}>
          {ABIL.map((a) => {
            const score = (data.abilities?.[a.key] as number) ?? 10;
            return (
              <View key={a.label} style={s.abilBox}>
                <Text style={s.abilTag}>{a.label}</Text>
                <Text style={s.abilMod}>{fmtMod(abilityMod(score))}</Text>
                <Text style={s.abilScore}>score {score}</Text>
              </View>
            );
          })}
          <Text style={s.sectionTitle}>Saving Throws</Text>
          {saves.length === 0 ? <Text style={s.label}>None recorded</Text> : saves.map((k) => (
            <View key={k.id} style={s.skillRow}>
              <View style={k.proficient ? s.dotOn : s.dotOff} />
              <Text style={{ color: p.accent2, width: 22 }}>{fmtMod(k.modifier ?? 0)}</Text>
              <Text style={{ color: k.proficient ? p.ink : p.muted, flex: 1 }}>{k.name}</Text>
            </View>
          ))}
        </View>

        {/* MIDDLE — skills */}
        <View style={{ width: "35%", paddingRight: 6 }}>
          <Text style={s.sectionTitle}>Skills</Text>
          <View style={s.row}>
            {[skills.slice(0, half), skills.slice(half)].map((group, gi) => (
              <View key={gi} style={{ flex: 1, paddingRight: 4 }}>
                {group.map((k) => (
                  <View key={k.id} style={s.skillRow}>
                    <View style={k.proficient ? s.dotOn : s.dotOff} />
                    <Text style={{ color: p.accent2, width: 20, fontSize: 7.5 }}>{fmtMod(k.modifier ?? 0)}</Text>
                    <Text style={{ color: k.proficient ? p.ink : p.muted, flex: 1, fontSize: 7.5 }}>{k.name}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
          {skills.length === 0 ? <Text style={s.label}>None recorded</Text> : null}
        </View>

        {/* RIGHT — attacks, equipment, coin */}
        <View style={{ width: "38%" }}>
          <Text style={s.sectionTitle}>Attacks</Text>
          {data.attacks.length === 0 ? <Text style={s.label}>None recorded</Text> : data.attacks.map((a) => (
            <View key={a.id} style={{ ...s.card, borderLeftWidth: 2.5, borderLeftColor: p.accent, marginBottom: 4 }}>
              <Text style={{ color: p.ink }}>{a.weapon_name || "Weapon"}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 1 }}>
                <Text style={{ color: p.accent2 }}>{a.attack_bonus || "—"}</Text>
                <Text style={s.label}>{[a.damage_dice, a.damage_type].filter(Boolean).join(" ") || "—"}</Text>
              </View>
            </View>
          ))}

          <Text style={s.sectionTitle}>Equipment</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {data.equipment.length === 0 ? <Text style={s.label}>Empty pack</Text> : data.equipment.map((e) => (
              <Text key={e.id} style={{ width: "50%", marginBottom: 1.5, fontSize: 7.5 }}>
                {e.emoji_icon ? `${e.emoji_icon} ` : "· "}{e.name}{e.quantity > 1 ? ` ×${e.quantity}` : ""}
              </Text>
            ))}
          </View>

          <Text style={s.sectionTitle}>Coin Purse</Text>
          <View style={{ flexDirection: "row" }}>
            {(["cp", "sp", "ep", "gp", "pp"] as const).map((k) => (
              <View key={k} style={k === "gp" ? { ...s.coin, ...s.coinGp } : s.coin}>
                <Text style={{ fontSize: 9, color: k === "gp" ? p.accent2 : p.ink }}>{money?.[k] ?? 0}</Text>
                <Text style={{ fontSize: 5.5, color: p.muted }}>{k.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <Divider p={p} />
      <Text style={s.sectionTitle}>Spells &amp; Divine Magics</Text>
      <View style={{ ...s.card, flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={s.label}>Ability: <Text style={s.val}>{data.spellMeta?.spellcasting_ability || "—"}</Text></Text>
        <Text style={s.label}>Save DC: <Text style={s.val}>{data.spellMeta?.spell_save_dc ?? "—"}</Text></Text>
        <Text style={s.label}>Attack: <Text style={s.val}>{data.spellMeta ? fmtMod(data.spellMeta.spell_attack_bonus ?? 0) : "—"}</Text></Text>
        <Text style={s.label}>
          Slots: <Text style={s.val}>{Object.entries(data.spellMeta?.slot_counts ?? {})
            .filter(([, n]) => Number(n) > 0)
            .map(([l, n]) => `L${l} ${Number(data.spellMeta?.slots_used?.[l] ?? 0)}/${n}`)
            .join("  ") || "—"}</Text>
        </Text>
      </View>
      {cantrips.length === 0 ? <Text style={s.label}>No cantrips known.</Text> : cantrips.map((sp) => (
        <View key={sp.id} style={s.spellCard} wrap={false}>
          <Text style={s.spellName}>{sp.name || "Unnamed Cantrip"}</Text>
          <Text style={s.label}>{[sp.school, sp.casting_time, sp.range, sp.duration].filter(Boolean).join(" · ") || "—"}</Text>
          {sp.description ? <Text style={{ ...s.p, marginTop: 2 }}>{String(sp.description).slice(0, 260)}</Text> : null}
        </View>
      ))}

      <Footer s={s} name={c.name || "Unnamed"} page={3} chapter="Stats" note={note} />
    </Page>
  );

  const ChroniclePage = (
    <Page size="A4" style={s.page}>
      <View style={s.washBottom} fixed />
      <Text style={s.titleSm}>Chronicle &amp; Session Log</Text>
      <Divider p={p} />

      <View style={s.row}>
        {/* LEFT — leveled spells */}
        <View style={{ width: "50%", paddingRight: 6 }}>
          <Text style={s.sectionTitle}>Prepared Spells</Text>
          {leveled.length === 0 ? <Text style={s.label}>No spells inscribed.</Text> : leveled.map((sp) => {
            const total = Number(data.spellMeta?.slot_counts?.[String(sp.spell_level)] ?? 0);
            const used = Number(data.spellMeta?.slots_used?.[String(sp.spell_level)] ?? 0);
            return (
              <View key={sp.id} style={s.spellCard} wrap={false}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={s.spellName}>{sp.name || "Unnamed Spell"}</Text>
                  <Text style={s.label}>Lv {sp.spell_level}</Text>
                </View>
                <Text style={s.label}>{[sp.school, sp.casting_time, sp.range].filter(Boolean).join(" · ") || "—"}</Text>
                {sp.description ? <Text style={{ ...s.p, marginTop: 2 }}>{String(sp.description).slice(0, 320)}</Text> : null}
                {total > 0 ? (
                  <View style={{ flexDirection: "row", marginTop: 2 }}>
                    {Array.from({ length: total }).map((_, i) => (
                      <View key={i} style={{ width: 6, height: 6, borderRadius: 3, marginRight: 3, borderWidth: 0.6, borderColor: p.accent, backgroundColor: i < used ? p.accent : "transparent" }} />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* RIGHT — session log */}
        <View style={{ width: "50%" }}>
          <Text style={s.sectionTitle}>Session Log</Text>
          {data.sessions.length === 0 ? <Text style={s.label}>No sessions recorded.</Text> : data.sessions.map((sn) => (
            <View key={sn.id} style={{ marginBottom: 6 }} wrap={false}>
              <View style={s.sessionHead}>
                <Text style={{ color: p.accent2, fontFamily: f.heading }}>
                  Session {sn.session_number}{sn.title ? ` — ${sn.title}` : ""}{sn.date_played ? `  (${sn.date_played})` : ""}
                </Text>
              </View>
              {(sn.notes ?? []).map((n, i) => <Text key={i} style={s.p}>🔥 {n}</Text>)}
              {sn.encounter_notes ? <Text style={s.label}>Encounters: {sn.encounter_notes}</Text> : null}
              {[0, 1, 2, 3].map((i) => <View key={i} style={s.ruled} />)}
            </View>
          ))}
        </View>
      </View>

      <Divider p={p} />
      <Text style={s.sectionTitle}>Features &amp; Traits</Text>
      <View style={s.card}>
        {(c.features ?? []).length === 0 ? <Text style={s.label}>None recorded</Text> : (c.features ?? []).map((ft, i) => (
          <Text key={i} style={s.p}>
            <Text style={{ color: p.accent2 }}>{ft.title}: </Text>{ft.description}
          </Text>
        ))}
      </View>

      {gallery.length > 0 ? (
        <>
          <Divider p={p} />
          <View style={{ flexDirection: "row" }}>
            {gallery.map((g) => (
              <Image key={g.id} src={g.image_url} style={{ width: 62, height: 62, objectFit: "cover", borderRadius: 6, marginRight: 5, borderWidth: 0.6, borderColor: p.border }} />
            ))}
          </View>
        </>
      ) : null}

      <Divider p={p} />
      <Text style={s.sectionTitle}>Notable Figures</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {data.npcs.length === 0 ? <Text style={s.label}>No figures recorded.</Text> : data.npcs.slice(0, 9).map((n) => (
          <View key={n.id} style={s.npcCard}>
            <Text style={{ fontSize: 12 }}>{n.emoji_icon || "❖"}</Text>
            <Text style={{ color: p.ink }}>{n.name || "Unknown"}</Text>
            <Text style={s.label}>{n.role || "—"}</Text>
            <Text style={{ ...s.badge, backgroundColor: dispColor(n.disposition, p) }}>{(n.disposition || "neutral").toUpperCase()}</Text>
          </View>
        ))}
      </View>

      {data.notes?.content ? (
        <>
          <Divider p={p} />
          <Text style={s.sectionTitle}>Loose Leaves</Text>
          <Text style={s.p}>{data.notes.content}</Text>
        </>
      ) : null}

      <Footer s={s} name={c.name || "Unnamed"} page={4} chapter="Chronicle" note={note} />
    </Page>
  );

  return (
    <Document title={`${c.name || "Character"} — Journal`} author={APP_NAME}>
      {CoverPage}
      {data.mainOnly ? null : PortraitPage}
      {StatsPage}
      {data.mainOnly ? null : ChroniclePage}
    </Document>
  );
}
