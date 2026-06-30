import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Character } from "@/lib/types";
import { abilityMod, fmtMod } from "@/lib/types";
import { Embers } from "./Embers";
import { CharacterGallery } from "./CharacterGallery";
import { useToast } from "./Toast";

const db = supabase as any;
const DISPS = ["ally", "neutral", "hostile", "missing"] as const;

export function NpcPage({
  initial, characters, onSwitch, onBackToSelect, onCreateNew, onSignOut,
}: {
  initial: Character;
  characters: Character[];
  onSwitch: (id: string) => void;
  onBackToSelect: () => void;
  onCreateNew: () => void;
  onSignOut: () => void;
}) {
  const [n, setN] = useState<Character>(initial);
  const [readOnly, setReadOnly] = useState(false);
  const [scores, setScores] = useState({ strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 });
  const [disposition, setDisposition] = useState<typeof DISPS[number]>("neutral");
  const toast = useToast();

  useEffect(() => {
    (async () => {
      const a = await db.from("ability_scores").select("*").eq("character_id", n.id).maybeSingle();
      if (a.data) setScores({
        strength: a.data.strength, dexterity: a.data.dexterity, constitution: a.data.constitution,
        intelligence: a.data.intelligence, wisdom: a.data.wisdom, charisma: a.data.charisma,
      });
      // Use first NPC row as the "disposition holder" for this NPC character
      const d = await db.from("npcs").select("disposition").eq("character_id", n.id).limit(1).maybeSingle();
      if (d.data?.disposition) setDisposition(d.data.disposition);
    })();
  }, [n.id]);

  async function patch(p: Partial<Character>) {
    const next = { ...n, ...p };
    setN(next);
    await db.from("characters").update(p).eq("id", n.id);
  }
  async function patchScore(k: keyof typeof scores, v: number) {
    const s = { ...scores, [k]: v };
    setScores(s);
    await db.from("ability_scores").update({ [k]: v }).eq("character_id", n.id);
  }

  async function setDisp(d: typeof DISPS[number]) {
    setDisposition(d);
    const row = await db.from("npcs").select("id").eq("character_id", n.id).limit(1).maybeSingle();
    if (row.data?.id) await db.from("npcs").update({ disposition: d }).eq("id", row.data.id);
    else await db.from("npcs").insert({ character_id: n.id, name: n.name, role: n.subtitle, description: "", disposition: d, emoji_icon: "👤" });
  }

  const players = characters.filter((c) => c.character_type === "player");
  const npcs = characters.filter((c) => c.character_type === "npc");

  return (
    <div className="min-h-screen relative">
      <Embers />
      <header className="sticky top-0 z-30 backdrop-blur bg-[rgba(16,11,3,0.85)] border-b border-[rgba(255,106,0,0.2)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <button className="j-btn j-btn-ghost" onClick={onBackToSelect}>← All</button>
          <div className="j-h text-xl truncate">🎭 NPC Codex</div>
          <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border border-[var(--color-muted)] text-[var(--color-muted)]">NPC</span>
          <div className="flex-1" />
          <button className="j-btn j-btn-ghost" onClick={() => setReadOnly(!readOnly)}>
            {readOnly ? "Edit Mode" : "Preview Mode"}
          </button>
          <button className="j-btn j-btn-ghost" onClick={onSignOut}>Sign Out</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        <div className="j-page p-6 md:p-10 pl-12 md:pl-16 relative">
          <div className="j-spine" />
          <div className="grid md:grid-cols-[1fr_2fr] gap-6">
            {/* LEFT: portrait + gallery */}
            <div>
              <div className="aspect-square w-full rounded overflow-hidden border border-[rgba(255,106,0,0.3)] bg-[var(--color-page-2)] mb-3 j-vignette relative">
                {n.image_url ? (
                  <img src={n.image_url} alt={n.name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-30">🎭</div>
                )}
              </div>
              <CharacterGallery
                characterId={n.id}
                userId={n.user_id}
                readOnly={readOnly}
                onPrimaryChange={(url) => patch({ image_url: url })}
              />
            </div>

            {/* RIGHT: details */}
            <div className="space-y-4">
              <div>
                {readOnly ? (
                  <h1 className="j-h text-4xl">{n.name || "Unnamed"}</h1>
                ) : (
                  <input className="j-h text-4xl bg-transparent w-full outline-none border-b border-dashed border-[rgba(255,106,0,0.25)] focus:border-[var(--color-ember)]"
                    value={n.name} onChange={(e) => patch({ name: e.target.value })} />
                )}
                {readOnly ? (
                  <p className="italic text-[var(--color-flame)] mt-1">{n.subtitle || "—"}</p>
                ) : (
                  <input className="italic text-[var(--color-flame)] mt-1 bg-transparent w-full outline-none"
                    placeholder="Role / title (e.g. Tavernkeeper of Wyrmpost)"
                    value={n.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(["race","alignment"] as const).map((k) => (
                  <div key={k} className="j-card">
                    <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">{k}</div>
                    {readOnly ? (
                      <div className="j-glow-text">{n[k] || <span className="text-[var(--color-muted)] italic">—</span>}</div>
                    ) : (
                      <input className="j-input" value={n[k]} onChange={(e) => patch({ [k]: e.target.value } as any)} />
                    )}
                  </div>
                ))}
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Disposition</div>
                <div className="flex gap-2 flex-wrap">
                  {DISPS.map((d) => (
                    <button key={d} disabled={readOnly}
                      onClick={() => setDisp(d)}
                      className={`text-[10px] uppercase tracking-widest px-3 py-1 rounded disposition-${d} ${disposition === d ? "ring-2 ring-[var(--color-ember)] ring-offset-1 ring-offset-[var(--color-page)]" : "opacity-60 hover:opacity-100"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="j-card">
                <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-2">Description / Bio</div>
                {readOnly ? (
                  <p className="leading-relaxed whitespace-pre-wrap">{n.backstory || <span className="text-[var(--color-muted)] italic">No record.</span>}</p>
                ) : (
                  <textarea className="bg-transparent w-full outline-none resize-y leading-relaxed min-h-[100px]"
                    placeholder="A short biography — who is this NPC?"
                    value={n.backstory} onChange={(e) => patch({ backstory: e.target.value })} />
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Stat label="HP" value={n.hp_current} max={n.hp_max} readOnly={readOnly}
                  onChange={(v) => patch({ hp_current: v })}
                  onMax={(v) => patch({ hp_max: v })} />
                <Stat label="AC" value={n.armor_class} readOnly={readOnly} onChange={(v) => patch({ armor_class: v })} />
                <Stat label="Speed" value={n.speed} suffix="ft" readOnly={readOnly} onChange={(v) => patch({ speed: v })} />
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(["strength","dexterity","constitution","intelligence","wisdom","charisma"] as const).map((k) => (
                  <div key={k} className="j-card text-center p-2">
                    <div className="text-[9px] uppercase tracking-widest text-[var(--color-muted)]">{k.slice(0,3)}</div>
                    {readOnly ? (
                      <div className="text-xl">{scores[k]}</div>
                    ) : (
                      <input type="number" className="j-num text-lg my-1" value={scores[k]} onChange={(e) => patchScore(k, parseInt(e.target.value) || 0)} />
                    )}
                    <div className="j-glow-text text-xs">{fmtMod(abilityMod(scores[k]))}</div>
                  </div>
                ))}
              </div>

              <div className="j-card">
                <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-2">🗣️ Notable Quotes / Roleplay Notes</div>
                {readOnly ? (
                  <p className="italic whitespace-pre-wrap leading-relaxed">{n.npc_quotes || <span className="text-[var(--color-muted)] not-italic">—</span>}</p>
                ) : (
                  <textarea className="bg-transparent w-full outline-none resize-y italic leading-relaxed min-h-[80px]"
                    placeholder={'"Step lightly, friend — the bones beneath this floor are still listening."'}
                    value={n.npc_quotes} onChange={(e) => patch({ npc_quotes: e.target.value })} />
                )}
              </div>

              <div className="j-card">
                <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-2">⚔️ Abilities / Actions</div>
                {readOnly ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{n.npc_actions || <span className="text-[var(--color-muted)] italic">—</span>}</p>
                ) : (
                  <textarea className="bg-transparent w-full outline-none resize-y leading-relaxed min-h-[80px]"
                    placeholder="• Multiattack: 2 daggers&#10;• Sneak Attack (1/turn): +2d6"
                    value={n.npc_actions} onChange={(e) => patch({ npc_actions: e.target.value })} />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-[var(--color-muted)] italic">
          Players: {players.length}/3 · NPCs: {npcs.length}/10
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, max, suffix, readOnly, onChange, onMax }: {
  label: string; value: number; max?: number; suffix?: string;
  readOnly: boolean; onChange: (v: number) => void; onMax?: (v: number) => void;
}) {
  return (
    <div className="j-card text-center p-2">
      <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">{label}</div>
      {readOnly ? (
        <div className="j-glow-text text-lg">{value}{max !== undefined && <span className="text-[var(--color-muted)]"> / {max}</span>}{suffix && <span className="text-xs text-[var(--color-muted)]"> {suffix}</span>}</div>
      ) : (
        <div className="flex items-center justify-center gap-1">
          <input type="number" className="j-num !w-14" value={value} onChange={(e) => onChange(parseInt(e.target.value) || 0)} />
          {onMax && (<><span className="text-[var(--color-muted)]">/</span>
            <input type="number" className="j-num !w-14" value={max ?? 0} onChange={(e) => onMax(parseInt(e.target.value) || 0)} /></>)}
        </div>
      )}
    </div>
  );
}
