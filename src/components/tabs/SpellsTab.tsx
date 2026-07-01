import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Spell, SpellMeta } from "@/lib/types";
import { abilityMod, profBonusForLevel, totalLevel } from "@/lib/types";
import { loadSpells, searchSpells, type ApiSpell } from "@/lib/spellSearch";

const db = supabase as any;

const ABILITY_KEYS: Record<string, string> = {
  INT: "intelligence", WIS: "wisdom", CHA: "charisma",
  STR: "strength", DEX: "dexterity", CON: "constitution",
};
function abilityKeyFor(label: string): string | null {
  if (!label) return null;
  const up = label.trim().slice(0, 3).toUpperCase();
  return ABILITY_KEYS[up] ?? null;
}

const SCHOOLS = ["Abjuration","Conjuration","Divination","Enchantment","Evocation","Illusion","Necromancy","Transmutation"];

export function SpellsTab({ characterId, readOnly }: { characterId: string; readOnly: boolean }) {
  const [meta, setMeta] = useState<SpellMeta | null>(null);
  const [spells, setSpells] = useState<Spell[]>([]);
  const [adding, setAdding] = useState<number | null>(null);
  const [abilities, setAbilities] = useState<any>(null);
  const [profBonus, setProfBonus] = useState<number>(2);

  useEffect(() => {
    (async () => {
      const [m, s, a, c] = await Promise.all([
        db.from("spell_meta").select("*").eq("character_id", characterId).maybeSingle(),
        db.from("spells").select("*").eq("character_id", characterId).order("spell_level"),
        db.from("ability_scores").select("*").eq("character_id", characterId).maybeSingle(),
        db.from("characters").select("class_level,class_level_2,proficiency_bonus").eq("id", characterId).maybeSingle(),
      ]);
      setMeta(m.data);
      setSpells(s.data ?? []);
      setAbilities(a.data ?? null);
      const lvl = totalLevel(c.data ?? { class_level: "", class_level_2: "" });
      setProfBonus(lvl > 0 ? profBonusForLevel(lvl) : (c.data?.proficiency_bonus ?? 2));
    })();
  }, [characterId]);

  // Derived spell DC / Atk bonus
  const abilityKey = abilityKeyFor(meta?.spellcasting_ability ?? "");
  const abilityScore = abilityKey && abilities ? abilities[abilityKey] ?? 10 : 10;
  const abilityModNum = abilityMod(abilityScore);
  const derivedDC = 8 + profBonus + abilityModNum;
  const derivedAtk = profBonus + abilityModNum;

  // Persist derived DC / Atk so saved record stays consistent
  useEffect(() => {
    if (!meta || !abilityKey) return;
    if (meta.spell_save_dc !== derivedDC || meta.spell_attack_bonus !== derivedAtk) {
      const patch = { spell_save_dc: derivedDC, spell_attack_bonus: derivedAtk };
      setMeta({ ...meta, ...patch });
      db.from("spell_meta").update(patch).eq("character_id", characterId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedDC, derivedAtk, abilityKey]);

  async function updateMeta(patch: Partial<SpellMeta>) {
    if (!meta) return;
    const next = { ...meta, ...patch };
    setMeta(next);
    await db.from("spell_meta").update(patch).eq("character_id", characterId);
  }

  async function toggleSlot(level: number, idx: number) {
    if (!meta || readOnly) return;
    const used = { ...meta.slots_used };
    const cur = used[String(level)] ?? 0;
    used[String(level)] = idx < cur ? idx : idx + 1;
    if (used[String(level)] > (meta.slot_counts[String(level)] ?? 0)) used[String(level)] = 0;
    updateMeta({ slots_used: used });
  }

  async function addSpell(level: number) {
    const { data } = await db.from("spells").insert({
      character_id: characterId, spell_level: level, name: "New Spell",
    }).select().single();
    if (data) { setSpells([...spells, data]); setAdding(null); }
  }
  async function updateSpell(s: Spell, patch: Partial<Spell>) {
    setSpells(spells.map((x) => x.id === s.id ? { ...x, ...patch } : x));
    await db.from("spells").update(patch).eq("id", s.id);
  }
  async function removeSpell(id: string) {
    setSpells(spells.filter((s) => s.id !== id));
    await db.from("spells").delete().eq("id", id);
  }

  if (!meta) return <div className="text-[var(--color-muted)] italic p-6">Kindling…</div>;

  const grouped: Record<number, Spell[]> = {};
  spells.forEach((s) => { (grouped[s.spell_level] ||= []).push(s); });
  const levels = Array.from(new Set([0, ...Object.keys(grouped).map(Number)])).sort((a,b) => a-b);

  return (
    <div className="j-fade space-y-6">
      <div className="j-card grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetaField label="Ability" value={meta.spellcasting_ability} readOnly={readOnly}
          onChange={(v) => updateMeta({ spellcasting_ability: v })} />
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Save DC</div>
          <div className="j-h text-2xl">{abilityKey ? derivedDC : "—"}</div>
          <div className="text-[10px] italic text-[var(--color-muted)]">8 + prof + mod</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Atk Bonus</div>
          <div className="j-h text-2xl">{abilityKey ? (derivedAtk >= 0 ? `+${derivedAtk}` : derivedAtk) : "—"}</div>
          <div className="text-[10px] italic text-[var(--color-muted)]">prof + mod</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Slot Setup</div>
          <div className="text-xs text-[var(--color-muted)]">Edit max in tracker below</div>
        </div>
      </div>

      {levels.map((lvl) => {
        const max = meta.slot_counts[String(lvl)] ?? 0;
        const used = meta.slots_used[String(lvl)] ?? 0;
        return (
          <div key={lvl}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="j-h" style={{ fontSize: "1.05rem" }}>
                {lvl === 0 ? "✦ Cantrips" : `✦ Level ${lvl}`}
              </h3>
              <div className="flex items-center gap-3">
                {lvl > 0 && (
                  <>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[var(--color-muted)]">Slots</span>
                      {!readOnly && (
                        <input type="number" className="j-num !w-12" value={max}
                          onChange={(e) => updateMeta({ slot_counts: { ...meta.slot_counts, [String(lvl)]: parseInt(e.target.value) || 0 } })} />
                      )}
                    </div>
                    <div className="flex gap-1">
                      {Array.from({ length: max }, (_, i) => (
                        <div key={i} className={`j-slot ${i < used ? "used" : ""}`} onClick={() => toggleSlot(lvl, i)} />
                      ))}
                    </div>
                  </>
                )}
                {!readOnly && <button className="j-btn" onClick={() => addSpell(lvl)}>+ Spell</button>}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {(grouped[lvl] ?? []).map((s) => (
                <div key={s.id} className="j-card">
                  {readOnly ? (
                    <>
                      <div className="j-glow-text" style={{ fontFamily: "var(--font-uncial)", fontSize: "1.1rem" }}>{s.name}</div>
                      <div className="italic text-[var(--color-muted)] text-sm mb-2">{s.school}</div>
                      <div className="text-xs text-[var(--color-muted)] grid grid-cols-2 gap-x-3 mb-2">
                        {s.casting_time && <div><strong className="text-[var(--color-flame)]">Cast:</strong> {s.casting_time}</div>}
                        {s.range && <div><strong className="text-[var(--color-flame)]">Range:</strong> {s.range}</div>}
                        {s.components && <div><strong className="text-[var(--color-flame)]">Comp:</strong> {s.components}</div>}
                        {s.duration && <div><strong className="text-[var(--color-flame)]">Dur:</strong> {s.duration}</div>}
                      </div>
                      <div style={{ fontSize: "0.95rem", lineHeight: 1.6 }}>{s.description}</div>
                      {s.upcast_note && <div className="italic text-[var(--color-flame)] text-sm mt-2"><em>At higher levels:</em> {s.upcast_note}</div>}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between gap-2">
                        <input className="j-input j-glow-text" style={{ fontFamily: "var(--font-uncial)" }} value={s.name} onChange={(e) => updateSpell(s, { name: e.target.value })} />
                        <button className="text-[var(--color-blood)] text-xs" onClick={() => removeSpell(s.id)}>✕</button>
                      </div>
                      <select className="j-input mt-1 italic text-sm bg-[var(--color-coal)]" value={s.school} onChange={(e) => updateSpell(s, { school: e.target.value })}>
                        <option value="">(school)</option>
                        {SCHOOLS.map((x) => <option key={x}>{x}</option>)}
                      </select>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        <input className="j-input" placeholder="Casting time" value={s.casting_time} onChange={(e) => updateSpell(s, { casting_time: e.target.value })} />
                        <input className="j-input" placeholder="Range" value={s.range} onChange={(e) => updateSpell(s, { range: e.target.value })} />
                        <input className="j-input" placeholder="Components" value={s.components} onChange={(e) => updateSpell(s, { components: e.target.value })} />
                        <input className="j-input" placeholder="Duration" value={s.duration} onChange={(e) => updateSpell(s, { duration: e.target.value })} />
                      </div>
                      <textarea className="j-textarea mt-2" rows={3} placeholder="Description"
                        style={{ fontSize: "0.95rem" }}
                        value={s.description} onChange={(e) => updateSpell(s, { description: e.target.value })} />
                      <input className="j-input mt-1 italic" placeholder="Upcast note (optional)"
                        value={s.upcast_note} onChange={(e) => updateSpell(s, { upcast_note: e.target.value })} />
                    </>
                  )}
                </div>
              ))}
              {(grouped[lvl] ?? []).length === 0 && (
                <div className="text-[var(--color-muted)] italic">No spells at this level</div>
              )}
            </div>
            {lvl < 9 && <div className="j-divider" />}
          </div>
        );
      })}
      {!readOnly && (
        <button className="j-btn" onClick={() => addSpell((levels[levels.length-1] ?? 0) + 1)}>+ Next Level</button>
      )}
    </div>
  );
}

function MetaField({ label, value, onChange, readOnly }: { label: string; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">{label}</div>
      {readOnly ? <div className="j-glow-text" style={{ fontFamily: "var(--font-uncial)" }}>{value}</div> :
        <input className="j-input" value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}
function MetaNum({ label, value, onChange, readOnly }: { label: string; value: number; onChange: (v: number) => void; readOnly: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">{label}</div>
      {readOnly ? <div className="j-h text-2xl">{value}</div> :
        <input type="number" className="j-num text-lg" value={value} onChange={(e) => onChange(parseInt(e.target.value) || 0)} />}
    </div>
  );
}
