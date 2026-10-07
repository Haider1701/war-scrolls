import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Character, Spell } from "@/lib/types";
import { formatMulticlass } from "@/lib/types";
import { pdfPalette } from "@/lib/pdf/palette";

const db = supabase as any;
const APP_NAME = "Ember Codex";
const lvlLabel = (l: number) => (l === 0 ? "Cantrips" : `Level ${l}`);

export function SpellCardModal({ characterId, spells, onClose }: { characterId: string; spells: Spell[]; onClose: () => void }) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(spells.filter((s) => s.name).map((s) => s.id)));
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    db.from("characters").select("*").eq("id", characterId).maybeSingle().then(({ data }: any) => setCharacter(data));
  }, [characterId]);

  const usable = spells.filter((s) => s.name);
  const byLevel = useMemo(() => {
    const m = new Map<number, Spell[]>();
    usable.forEach((s) => m.set(s.spell_level, [...(m.get(s.spell_level) ?? []), s]));
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [spells]);
  const chosen = usable.filter((s) => selected.has(s.id)).sort((a, b) => a.spell_level - b.spell_level || a.name.localeCompare(b.name));
  const pages = Math.ceil(chosen.length / 9);
  const preview = chosen[Math.min(idx, chosen.length - 1)];
  const p = pdfPalette(character?.theme, character?.custom_theme);
  const klass = formatMulticlass(character?.class_level, character?.class_level_2);

  function toggle(id: string) { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); }
  function toggleLevel(list: Spell[]) {
    const all = list.every((s) => selected.has(s.id));
    const n = new Set(selected); list.forEach((s) => (all ? n.delete(s.id) : n.add(s.id))); setSelected(n);
  }

  async function exportPdf() {
    if (!chosen.length || !character) return;
    setBusy(true);
    try {
      const [{ pdf }, { SpellCardsPdf }, { registerThemeFonts }] = await Promise.all([
        import("@react-pdf/renderer"), import("@/lib/pdf/SpellCardsPdf"), import("@/lib/pdf/fonts"),
      ]);
      const fonts = await registerThemeFonts(character.theme, character.custom_theme);
      const blob = await pdf(<SpellCardsPdf spells={chosen} owner={character.name || "Adventurer"} klass={klass} palette={p} fonts={fonts} appName={APP_NAME} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${(character.name || "Character").replace(/[^a-z0-9]+/gi, "")}_SpellCards.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3" onClick={onClose}>
      <div className="j-page w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl flex flex-col" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Print spell cards">
        <div className="flex items-center justify-between p-4 border-b border-[rgba(255,106,0,0.2)]">
          <h2 className="j-h text-2xl">🃏 Print Spell Cards</h2>
          <button onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto grid md:grid-cols-2 gap-4 p-4">
          <div className="space-y-3">
            {byLevel.length === 0 && <div className="italic text-[var(--color-muted)]">No named spells to print yet.</div>}
            {byLevel.map(([lvl, list]) => (
              <div key={lvl} className="j-card !p-3">
                <label className="flex items-center gap-2 font-semibold cursor-pointer">
                  <input type="checkbox" checked={list.every((s) => selected.has(s.id))} onChange={() => toggleLevel(list)} />
                  Select All {lvlLabel(lvl)} <span className="text-xs text-[var(--color-muted)]">({list.length})</span>
                </label>
                <div className="mt-2 pl-5 space-y-1">
                  {list.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} /> {s.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-3">
            {preview ? (
              <>
                <CardPreview spell={preview} palette={p} owner={character?.name ?? ""} klass={klass} />
                <div className="flex items-center gap-3">
                  <button className="j-btn j-btn-ghost !px-3" disabled={idx <= 0} onClick={() => setIdx(idx - 1)} aria-label="Previous card">‹</button>
                  <span className="text-xs text-[var(--color-muted)]">{Math.min(idx, chosen.length - 1) + 1} / {chosen.length}</span>
                  <button className="j-btn j-btn-ghost !px-3" disabled={idx >= chosen.length - 1} onClick={() => setIdx(idx + 1)} aria-label="Next card">›</button>
                </div>
              </>
            ) : <div className="italic text-[var(--color-muted)] mt-10">Select spells to preview.</div>}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-4 border-t border-[rgba(255,106,0,0.2)]">
          <span className="text-sm">{chosen.length} card{chosen.length === 1 ? "" : "s"} selected ({pages} A4 page{pages === 1 ? "" : "s"} + {pages} back{pages === 1 ? "" : "s"})</span>
          <button className="j-btn" disabled={!chosen.length || busy || !character} onClick={exportPdf}>{busy ? "Binding cards…" : "📄 Export PDF"}</button>
        </div>
      </div>
    </div>
  );
}

function CardPreview({ spell: s, palette: p, owner, klass }: { spell: Spell; palette: ReturnType<typeof pdfPalette>; owner: string; klass: string }) {
  return (
    <div style={{ width: 252, height: 352, background: p.panel, border: `1px solid ${p.border}`, borderRadius: 10, overflow: "hidden", position: "relative", color: p.ink, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
      <div style={{ background: p.bg, borderBottom: `1px solid ${p.accent}`, padding: "8px 10px" }}>
        <div style={{ color: p.accent2, fontFamily: "var(--font-uncial)", fontSize: 16, lineHeight: 1.1 }}>{s.name}</div>
        <div style={{ color: p.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginTop: 3 }}>{[s.school, s.spell_level === 0 ? "Cantrip" : `Level ${s.spell_level}`].filter(Boolean).join(" · ")}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", margin: "6px 14px" }}>
        <div style={{ flex: 1, height: 1, background: p.accent }} /><div style={{ width: 6, height: 6, background: p.accent2, transform: "rotate(45deg)", margin: "0 4px" }} /><div style={{ flex: 1, height: 1, background: p.accent }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, padding: "0 8px" }}>
        {[["⏱", s.casting_time], ["📏", s.range], ["⏳", s.duration], ["🔮", s.components]].map(([i, v], k) => (
          <div key={k} style={{ border: `1px solid ${p.border}55`, borderRadius: 5, padding: "2px 4px", fontSize: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i} {v || "—"}</div>
        ))}
      </div>
      <div style={{ fontSize: 9, lineHeight: 1.35, padding: "6px 10px", maxHeight: 190, overflow: "hidden" }}>{s.description}</div>
      {s.upcast_note && <div style={{ fontSize: 8.5, fontStyle: "italic", color: p.muted, padding: "0 10px" }}>At Higher Levels: {s.upcast_note}</div>}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "space-between", background: p.bg, borderTop: `1px solid ${p.accent}`, padding: "4px 8px", fontSize: 8 }}>
        <span>{[owner, klass].filter(Boolean).join(" · ")}</span><span style={{ color: p.muted, fontSize: 7 }}>{APP_NAME}</span>
      </div>
    </div>
  );
}
