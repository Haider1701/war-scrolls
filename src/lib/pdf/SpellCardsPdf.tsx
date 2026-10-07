import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Spell } from "../types";
import type { PdfPalette } from "./palette";
import type { PdfFonts } from "./fonts";

// 63mm × 88mm in points
export const CARD_W = 178.6;
export const CARD_H = 249.4;
const COLS = 3, ROWS = 3, PER_PAGE = COLS * ROWS;
const GAP = 6;
const PAGE_W = 595.28, PAGE_H = 841.89;
const GRID_W = COLS * CARD_W + (COLS - 1) * GAP;
const GRID_H = ROWS * CARD_H + (ROWS - 1) * GAP;
const OX = (PAGE_W - GRID_W) / 2, OY = (PAGE_H - GRID_H) / 2;

export const levelLabel = (l: number) => (l === 0 ? "Cantrip" : `Level ${l}`);

type Props = { spells: Spell[]; owner: string; klass: string; palette: PdfPalette; fonts: PdfFonts; appName: string };

function chunk<T>(a: T[], n: number) { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }

export function SpellCardsPdf({ spells, owner, klass, palette: p, fonts: f, appName }: Props) {
  const s = StyleSheet.create({
    page: { backgroundColor: "#ffffff", position: "relative" },
    card: { position: "absolute", width: CARD_W, height: CARD_H, backgroundColor: p.panel, borderWidth: 1, borderColor: p.border, borderRadius: 6, overflow: "hidden" },
    head: { backgroundColor: p.bg, borderBottomWidth: 1, borderBottomColor: p.accent, paddingHorizontal: 7, paddingVertical: 5 },
    name: { fontFamily: f.heading, fontSize: 11.5, color: p.accent2 },
    badge: { fontFamily: f.body, fontSize: 6.5, color: p.muted, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.6 },
    divider: { flexDirection: "row", alignItems: "center", marginHorizontal: 10, marginVertical: 4 },
    line: { flex: 1, height: 0.6, backgroundColor: p.accent },
    diamond: { width: 4, height: 4, backgroundColor: p.accent2, transform: "rotate(45deg)", marginHorizontal: 3 },
    stats: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 6, gap: 2 },
    pill: { width: (CARD_W - 16) / 2, borderWidth: 0.5, borderColor: p.border, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1.5, marginBottom: 2 },
    pillLabel: { fontSize: 5, color: p.muted, fontFamily: f.body, textTransform: "uppercase" },
    pillVal: { fontSize: 6.3, color: p.ink, fontFamily: f.body },
    desc: { fontFamily: f.body, fontSize: 6.4, lineHeight: 1.3, color: p.ink, paddingHorizontal: 7, paddingTop: 3 },
    upcast: { fontFamily: f.body, fontSize: 6, fontStyle: "italic", color: p.muted, paddingHorizontal: 7, paddingTop: 3 },
    foot: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", justifyContent: "space-between", backgroundColor: p.bg, borderTopWidth: 0.6, borderTopColor: p.accent, paddingHorizontal: 6, paddingVertical: 3 },
    footL: { fontSize: 5.5, color: p.ink, fontFamily: f.body },
    footR: { fontSize: 4.5, color: p.muted, fontFamily: f.body },
    back: { position: "absolute", width: CARD_W, height: CARD_H, backgroundColor: p.bg, borderRadius: 6, padding: 7 },
    frame: { flex: 1, borderWidth: 1.2, borderColor: p.accent, borderRadius: 4, padding: 4 },
    frame2: { flex: 1, borderWidth: 0.5, borderColor: p.accent2, borderRadius: 3, alignItems: "center", justifyContent: "center" },
    logo: { fontFamily: f.heading, fontSize: 18, color: p.accent2, textAlign: "center" },
    sub: { fontFamily: f.body, fontSize: 7, color: p.muted, marginTop: 4, letterSpacing: 1.5, textTransform: "uppercase" },
    backName: { position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", fontFamily: f.heading, fontSize: 9, color: p.ink },
    mark: { position: "absolute", backgroundColor: "#999999" },
  });

  const pos = (i: number, mirror = false) => {
    const r = Math.floor(i / COLS), c0 = i % COLS, c = mirror ? COLS - 1 - c0 : c0;
    return { left: OX + c * (CARD_W + GAP), top: OY + r * (CARD_H + GAP) };
  };

  const marks = (i: number, mirror = false) => {
    const { left, top } = pos(i, mirror); const L = 6, T = 0.4;
    const corners = [[left, top], [left + CARD_W, top], [left, top + CARD_H], [left + CARD_W, top + CARD_H]];
    return corners.flatMap(([x, y], k) => [
      <View key={`h${i}-${k}`} style={[s.mark, { left: x - L / 2, top: y - T / 2, width: L, height: T }]} />,
      <View key={`v${i}-${k}`} style={[s.mark, { left: x - T / 2, top: y - L / 2, width: T, height: L }]} />,
    ]);
  };

  const trim = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);

  return (
    <Document title={`${owner} — Spell Cards`}>
      {chunk(spells, PER_PAGE).flatMap((group, pi) => [
        <Page key={`f${pi}`} size="A4" style={s.page}>
          {group.map((sp, i) => (
            <View key={sp.id} style={[s.card, pos(i)]}>
              <View style={s.head}>
                <Text style={s.name}>{trim(sp.name || "Unnamed", 34)}</Text>
                <Text style={s.badge}>{[sp.school, levelLabel(sp.spell_level)].filter(Boolean).join(" · ")}</Text>
              </View>
              <View style={s.divider}><View style={s.line} /><View style={s.diamond} /><View style={s.line} /></View>
              <View style={s.stats}>
                {([["Casting", sp.casting_time], ["Range", sp.range], ["Duration", sp.duration], ["Components", sp.components]] as const).map(([l, v]) => (
                  <View key={l} style={s.pill}><Text style={s.pillLabel}>{l}</Text><Text style={s.pillVal}>{trim(v || "—", 30)}</Text></View>
                ))}
              </View>
              <Text style={s.desc}>{trim(sp.description || "", sp.upcast_note ? 620 : 760)}</Text>
              {!!sp.upcast_note && <Text style={s.upcast}>At Higher Levels: {trim(sp.upcast_note, 160)}</Text>}
              <View style={s.foot}>
                <Text style={s.footL}>{trim([owner, klass].filter(Boolean).join(" · "), 40)}</Text>
                <Text style={s.footR}>{appName}</Text>
              </View>
            </View>
          ))}
          {group.flatMap((_, i) => marks(i))}
        </Page>,
        <Page key={`b${pi}`} size="A4" style={s.page}>
          {group.map((sp, i) => (
            <View key={sp.id} style={[s.back, pos(i, true)]}>
              <View style={s.frame}><View style={s.frame2}>
                <Text style={s.logo}>{appName}</Text>
                <Text style={s.sub}>✦ Spell Card ✦</Text>
              </View></View>
              <Text style={s.backName}>{owner}</Text>
            </View>
          ))}
          {group.flatMap((_, i) => marks(i, true))}
        </Page>,
      ])}
    </Document>
  );
}
