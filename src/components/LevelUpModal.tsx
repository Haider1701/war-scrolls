import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Abilities, Character } from "@/lib/types";
import { abilityMod, profBonusForLevel, totalLevel, SKILL_LIST, SAVE_LIST } from "@/lib/types";
import { recalcSkillModifier, recalcSpellNumbers } from "@/lib/levelUpMath";
import { CLASS_HIT_DIE, parseClassString } from "@/lib/dnd-data";
import {
  SUBCLASSES, cantripsGainedAtLevel, featuresForLevel, isSpellcaster, maxSpellLevel,
  slotDiff, slotsForClassLevel, spellsLearnedAtLevel,
} from "@/lib/levelUpData";
import { loadSpells, type ApiSpell } from "@/lib/spellSearch";
import { logCharacterEvent } from "./CharacterTimeline";

const db = supabase as any;
const ABILS: (keyof Abilities)[] = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const SHORT: Record<string, string> = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };

function bumpLevel(s: string): string {
  const m = s.match(/(\d+)\s*$/);
  if (!m) return `${s.trim()} 2`.trim();
  return s.slice(0, m.index) + String(parseInt(m[1], 10) + 1);
}

export function LevelUpModal({ character, onClose, onApplied }: {
  character: Character; onClose: () => void; onApplied: (c: Character) => void;
}) {
  const [step, setStep] = useState(1);
  const [which, setWhich] = useState<1 | 2>(1);
  const [abilities, setAbilities] = useState<Abilities | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [hpMode, setHpMode] = useState<"roll" | "avg" | null>(null);
  const [rolled, setRolled] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [asiMode, setAsiMode] = useState<"two" | "split">("two");
  const [asiA, setAsiA] = useState<keyof Abilities>("strength");
  const [asiB, setAsiB] = useState<keyof Abilities>("constitution");
  const [subclass, setSubclass] = useState<string>("");
  const [allSpells, setAllSpells] = useState<ApiSpell[]>([]);
  const [picked, setPicked] = useState<ApiSpell[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    (async () => {
      const [a, m] = await Promise.all([
        db.from("ability_scores").select("*").eq("character_id", character.id).maybeSingle(),
        db.from("spell_meta").select("*").eq("character_id", character.id).maybeSingle(),
      ]);
      setAbilities(a.data ?? { character_id: character.id, strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 });
      setMeta(m.data);
    })();
    loadSpells().then(setAllSpells).catch(() => {});
  }, [character.id]);

  const hasSecond = !!(character.class_level_2 && character.class_level_2.trim());
  const classStr = which === 1 ? character.class_level : (character.class_level_2 ?? "");
  const parsed = parseClassString(classStr);
  const cls = parsed.className;
  const newClassLvl = parsed.level + 1;
  const curTotal = totalLevel(character);
  const hd = CLASS_HIT_DIE[cls] ?? 8;
  const conMod = abilityMod(abilities?.constitution ?? 10);
  const avg = Math.floor(hd / 2) + 1;
  const hpGain = Math.max(1, (hpMode === "roll" ? rolled ?? 0 : avg) + conMod);

  const features = useMemo(() => featuresForLevel(cls, newClassLvl), [cls, newClassLvl]);
  const hasAsi = features.some((f) => f.choice?.kind === "asi");
  const hasSub = features.some((f) => f.choice?.kind === "subclass");
  const caster = isSpellcaster(cls);
  const oldSlots = slotsForClassLevel(cls, parsed.level);
  const newSlots = slotsForClassLevel(cls, newClassLvl);
  const newSlotList = slotDiff(oldSlots, newSlots);
  const spellCount = caster ? spellsLearnedAtLevel(cls, newClassLvl) : 0;
  const cantripCount = caster ? cantripsGainedAtLevel(cls, newClassLvl) : 0;
  const maxLvl = maxSpellLevel(cls, newClassLvl);

  const pickedLeveled = picked.filter((s) => s.level_int > 0).length;
  const pickedCantrips = picked.filter((s) => s.level_int === 0).length;

  const spellPool = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSpells
      .filter((s) => (s.dnd_class ?? "").toLowerCase().includes(cls.toLowerCase()))
      .filter((s) => s.level_int <= maxLvl)
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.level_int - b.level_int || a.name.localeCompare(b.name))
      .slice(0, 60);
  }, [allSpells, cls, maxLvl, query]);

  const asiChanges: Partial<Record<keyof Abilities, number>> = !hasAsi ? {} :
    asiMode === "two" ? { [asiA]: 2 } : asiA === asiB ? { [asiA]: 2 } : { [asiA]: 1, [asiB]: 1 };

  function rollHp() {
    setHpMode("roll");
    setRolling(true);
    let n = 0;
    const iv = window.setInterval(() => {
      setRolled(1 + Math.floor(Math.random() * hd));
      if (++n > 12) { window.clearInterval(iv); setRolling(false); }
    }, 70);
  }

  function togglePick(s: ApiSpell) {
    if (picked.some((p) => p.slug === s.slug)) { setPicked(picked.filter((p) => p.slug !== s.slug)); return; }
    if (s.level_int === 0 && pickedCantrips >= Math.max(cantripCount, 0) && cantripCount > 0) return;
    if (s.level_int > 0 && spellCount > 0 && pickedLeveled >= spellCount) return;
    setPicked([...picked, s]);
  }

  async function confirm() {
    if (!abilities) return;
    setSaving(true);
    const nextClass = bumpLevel(classStr);
    const patch: any = {
      [which === 1 ? "class_level" : "class_level_2"]: nextClass,
      hp_max: character.hp_max + hpGain,
      hp_current: character.hp_current + hpGain,
      pending_level_up: false,
      level_up_approved_by_dm: false,
    };
    const newTotal = curTotal + 1;
    const prof = profBonusForLevel(newTotal);
    patch.proficiency_bonus = prof;

    // Abilities
    const nextAb: any = { ...abilities };
    for (const [k, v] of Object.entries(asiChanges)) nextAb[k] = Math.min(20, (nextAb[k] ?? 10) + (v as number));
    if (Object.keys(asiChanges).length) {
      const upd = Object.fromEntries(ABILS.map((k) => [k, nextAb[k]]));
      if (abilities.id) await db.from("ability_scores").update(upd).eq("character_id", character.id);
      else await db.from("ability_scores").insert({ character_id: character.id, ...upd });
    }

    // Passive perception
    const { data: perc } = await db.from("skills").select("proficient").eq("character_id", character.id).eq("kind", "skill").eq("name", "Perception").maybeSingle();
    patch.passive_perception = 10 + abilityMod(nextAb.wisdom ?? 10) + (perc?.proficient ? prof : 0);

    // Features list
    const featureList = [...(character.features ?? [])];
    for (const f of features) {
      if (f.choice?.kind === "subclass") {
        const sc = SUBCLASSES[cls]?.find((s) => s.name === subclass);
        if (sc) featureList.push({ title: `${cls} ${newClassLvl}: ${sc.name}`, description: sc.description });
      } else if (f.choice?.kind === "asi") {
        featureList.push({ title: `${cls} ${newClassLvl}: Ability Score Improvement`, description: Object.entries(asiChanges).map(([k, v]) => `${SHORT[k]} +${v}`).join(", ") });
      } else {
        featureList.push({ title: `${cls} ${newClassLvl}: ${f.name}`, description: f.description });
      }
    }
    patch.features = featureList;

    const { data: saved } = await db.from("characters").update(patch).eq("id", character.id).select().single();

    // Recalculate skills & saves from new abilities + proficiency
    const { data: skillRows } = await db.from("skills").select("id,name,kind,proficient").eq("character_id", character.id);
    await Promise.all((skillRows ?? []).map((r: any) => {
      const def = (r.kind === "save" ? SAVE_LIST : SKILL_LIST).find((x) => x.name === r.name);
      if (!def) return null;
      return db.from("skills").update({ modifier: recalcSkillModifier(nextAb[def.ability] ?? 10, !!r.proficient, prof) }).eq("id", r.id);
    }));

    // Spell save DC & attack
    if (meta?.spellcasting_ability) {
      const key = ABILS.find((k) => k.startsWith(String(meta.spellcasting_ability).toLowerCase().slice(0, 3)));
      if (key) {
        const n = recalcSpellNumbers(nextAb[key] ?? 10, prof);
        await db.from("spell_meta").update({ spell_save_dc: n.dc, spell_attack_bonus: n.attack }).eq("character_id", character.id);
        meta.spell_save_dc = n.dc; meta.spell_attack_bonus = n.attack;
      }
    }

    // Spell slots
    if (caster && Object.keys(newSlots).length) {
      const merged: Record<string, number> = { ...(meta?.slot_counts ?? {}) };
      for (const [k, v] of Object.entries(newSlots)) merged[k] = Math.max(merged[k] ?? 0, v + Math.max(0, (merged[k] ?? 0) - (oldSlots[k] ?? 0)));
      if (meta) await db.from("spell_meta").update({ slot_counts: merged }).eq("character_id", character.id);
      else await db.from("spell_meta").insert({ character_id: character.id, slot_counts: merged, slots_used: {}, spellcasting_ability: "", spell_save_dc: 8, spell_attack_bonus: 0 });
    }

    // New spells
    if (picked.length) {
      await db.from("spells").insert(picked.map((s) => ({
        character_id: character.id, spell_level: s.level_int, name: s.name, school: s.school,
        casting_time: s.casting_time, range: s.range, components: s.components, duration: s.duration,
        description: s.desc, upcast_note: s.higher_level ?? "", is_homebrew: false, gm_approved: true,
      })));
    }

    await logCharacterEvent({
      character_id: character.id, event_type: "level_up", level_at: newTotal,
      title: `Reached level ${newTotal}`,
      description: [`${cls} ${newClassLvl}`, `HP +${hpGain}`, ...features.map((f) => f.choice?.kind === "subclass" ? subclass : f.name), ...picked.map((p) => `Spell: ${p.name}`)].filter(Boolean).join(" · "),
    });
    setSaving(false);
    setCelebrate(true);
    window.setTimeout(() => {
      onApplied({ ...character, ...(saved ?? patch) });
      onClose();
    }, 1600);
  }

  const canNext =
    step === 1 ? !!cls :
    step === 2 ? hpMode !== null && !rolling && (hpMode === "avg" || rolled !== null) :
    step === 3 ? (!hasSub || !!subclass) : true;

  const showSpellStep = caster && (newSlotList.length > 0 || spellCount > 0 || cantripCount > 0);
  const nextStep = () => setStep((s) => (s === 3 && !showSpellStep ? 5 : s + 1));
  const prevStep = () => setStep((s) => (s === 5 && !showSpellStep ? 3 : s - 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="j-page relative w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 md:p-7 rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Level Up Assistant">
        {celebrate && (
          <div className="lvl-celebrate pointer-events-none absolute inset-0 rounded-2xl overflow-hidden z-10">
            <div className="lvl-flash" />
            {Array.from({ length: 36 }).map((_, i) => (
              <span key={i} className="lvl-spark" style={{ ["--a" as any]: `${(i / 36) * 360}deg`, ["--d" as any]: `${120 + (i % 5) * 40}px` }} />
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="j-h text-4xl j-glow-text">⬆️ Level {curTotal + 1}!</div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="j-h text-2xl j-glow-text">Level Up Assistant</h2>
          <button className="text-[var(--color-muted)] text-xl" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="flex gap-1 mb-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-1.5 flex-1 rounded-full" style={{ background: n <= step ? "var(--color-ember)" : "rgba(255,106,0,0.15)", opacity: n === 4 && !showSpellStep ? 0.3 : 1 }} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="j-card text-center">
              <div className="j-h text-3xl">⬆️ Leveling up from {curTotal} to {curTotal + 1}</div>
              <div className="text-sm text-[var(--color-muted)] mt-1">{character.name}</div>
            </div>
            {hasSecond ? (
              <div className="j-card space-y-2">
                <div className="text-sm">Are you leveling up in {character.class_level} or {character.class_level_2}?</div>
                {([1, 2] as const).map((n) => (
                  <label key={n} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={which === n} onChange={() => { setWhich(n); setSubclass(""); setPicked([]); }} />
                    <span>{n === 1 ? character.class_level : character.class_level_2}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="j-card text-sm">Class: <span className="text-[var(--color-flame)]">{character.class_level || "—"}</span></div>
            )}
            {!cls && <div className="text-xs text-[var(--color-blood)]">Set your class on the Cover tab first.</div>}
            <div className="text-xs text-[var(--color-muted)] italic">{cls} {parsed.level} → {cls} {newClassLvl}</div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <button className={`j-card text-left transition ${hpMode === "roll" ? "ring-2 ring-[var(--color-ember)]" : ""}`} onClick={rollHp}>
                <div className="j-h text-lg">🎲 Roll for HP</div>
                <div className="text-xs text-[var(--color-muted)]">d{hd} + CON ({conMod >= 0 ? "+" : ""}{conMod})</div>
                {hpMode === "roll" && rolled !== null && (
                  <div className={`j-h text-4xl mt-2 text-center ${rolling ? "lvl-dice-spin" : ""}`}>{rolled}</div>
                )}
              </button>
              <button className={`j-card text-left transition ${hpMode === "avg" ? "ring-2 ring-[var(--color-ember)]" : ""}`} onClick={() => setHpMode("avg")}>
                <div className="j-h text-lg">📊 Take Average</div>
                <div className="text-xs text-[var(--color-muted)]">{cls || "Class"}: {avg} + CON mod ({conMod >= 0 ? "+" : ""}{conMod})</div>
                {hpMode === "avg" && <div className="j-h text-4xl mt-2 text-center">{avg}</div>}
              </button>
            </div>
            {hpMode && !rolling && (
              <div className="j-card text-center">HP will increase by <b className="text-[var(--color-flame)]">{hpGain}</b>. New total: <b className="text-[var(--color-flame)]">{character.hp_max + hpGain}</b></div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            {features.length === 0 && <div className="j-card italic text-[var(--color-muted)]">No new class features at {cls} {newClassLvl} — but your power still grows.</div>}
            {features.map((f, i) => (
              <div key={i} className="j-card">
                <div className="j-h text-lg text-[var(--color-flame)]">{f.name}</div>
                <p className="text-sm mt-1">{f.description}</p>
                {f.choice?.kind === "asi" && abilities && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-3 text-sm">
                      <label className="flex items-center gap-1"><input type="radio" checked={asiMode === "two"} onChange={() => setAsiMode("two")} /> +2 to one</label>
                      <label className="flex items-center gap-1"><input type="radio" checked={asiMode === "split"} onChange={() => setAsiMode("split")} /> +1 to two</label>
                    </div>
                    <div className="flex gap-2">
                      <select className="j-input" value={asiA} onChange={(e) => setAsiA(e.target.value as any)}>
                        {ABILS.map((k) => <option key={k} value={k}>{SHORT[k]} ({abilities[k]})</option>)}
                      </select>
                      {asiMode === "split" && (
                        <select className="j-input" value={asiB} onChange={(e) => setAsiB(e.target.value as any)}>
                          {ABILS.filter((k) => k !== asiA).map((k) => <option key={k} value={k}>{SHORT[k]} ({abilities[k]})</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                )}
                {f.choice?.kind === "subclass" && (
                  <div className="mt-3 grid gap-2">
                    {(SUBCLASSES[cls] ?? []).map((s) => (
                      <label key={s.name} className={`rounded-xl p-3 border cursor-pointer transition ${subclass === s.name ? "border-[var(--color-ember)] bg-[rgba(255,106,0,0.1)]" : "border-[rgba(255,106,0,0.2)]"}`}>
                        <div className="flex items-center gap-2"><input type="radio" checked={subclass === s.name} onChange={() => setSubclass(s.name)} /><b>{s.name}</b></div>
                        <div className="text-xs text-[var(--color-muted)] mt-1">{s.description}</div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            {newSlotList.length > 0 && (
              <div className="j-card">
                <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">New spell slots</div>
                {newSlotList.map((s) => <div key={s.level}>✨ Level {s.level} slot ×{s.added} <span className="text-xs text-[var(--color-muted)]">(now {s.total})</span></div>)}
              </div>
            )}
            <div className="j-card">
              <div className="text-sm mb-2">
                {spellCount > 0 ? <>Choose <b>{spellCount}</b> new spell{spellCount > 1 ? "s" : ""} ({pickedLeveled}/{spellCount})</> : <>Your class prepares spells — optionally add some to your spellbook.</>}
                {cantripCount > 0 && <> · Choose <b>{cantripCount}</b> cantrip ({pickedCantrips}/{cantripCount})</>}
                <span className="text-xs text-[var(--color-muted)]"> · up to level {maxLvl}</span>
              </div>
              <input className="j-input mb-2" placeholder="Search spells…" value={query} onChange={(e) => setQuery(e.target.value)} />
              {allSpells.length === 0 && <div className="text-xs italic text-[var(--color-muted)]">Summoning the spell list…</div>}
              <div className="max-h-64 overflow-y-auto space-y-1">
                {spellPool.map((s) => {
                  const on = picked.some((p) => p.slug === s.slug);
                  return (
                    <button key={s.slug} onClick={() => togglePick(s)} className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition ${on ? "bg-[rgba(255,106,0,0.2)] border border-[var(--color-ember)]" : "hover:bg-[rgba(255,106,0,0.08)]"}`}>
                      <span className="text-[var(--color-muted)] text-xs w-14 inline-block">{s.level_int === 0 ? "Cantrip" : `Lvl ${s.level_int}`}</span>{s.name}
                      <span className="text-xs text-[var(--color-muted)]"> · {s.school}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="j-card space-y-1.5" style={{ borderColor: "var(--color-flame)" }}>
            <div className="j-h text-xl mb-2">What Changed</div>
            <div>✅ Level: {curTotal} → {curTotal + 1} <span className="text-xs text-[var(--color-muted)]">({cls} {newClassLvl})</span></div>
            <div>✅ HP: {character.hp_max} → {character.hp_max + hpGain} (+{hpGain})</div>
            {profBonusForLevel(curTotal + 1) !== profBonusForLevel(curTotal) && <div>✅ Proficiency: +{profBonusForLevel(curTotal)} → +{profBonusForLevel(curTotal + 1)}</div>}
            {features.map((f, i) => (
              <div key={i}>✅ New Feature: {f.choice?.kind === "asi"
                ? `ASI — ${Object.entries(asiChanges).map(([k, v]) => `${SHORT[k]} +${v}`).join(", ")}`
                : f.choice?.kind === "subclass" ? `${f.name} — ${subclass}` : f.name}</div>
            ))}
            {newSlotList.map((s) => <div key={s.level}>✅ New Spell Slot: level {s.level} (×{s.added})</div>)}
            {picked.map((s) => <div key={s.slug}>✅ New {s.level_int === 0 ? "Cantrip" : "Spell"}: {s.name}</div>)}
          </div>
        )}

        <div className="flex justify-between mt-6">
          <button className="j-btn j-btn-ghost" onClick={step === 1 ? onClose : prevStep} disabled={saving}>{step === 1 ? "Cancel" : "← Go Back"}</button>
          {step < 5 ? (
            <button className="j-btn" disabled={!canNext} onClick={nextStep}>Continue →</button>
          ) : (
            <button className="j-btn" disabled={saving || celebrate} onClick={confirm}>{saving ? "Inscribing…" : "✅ Confirm Level Up"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Small "Level Up!" trigger + modal, shared by Cover and Stats tabs. */
export function LevelUpButton({ character, onApplied, readOnly }: {
  character: Character; onApplied: (c: Character) => void; readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (readOnly) return null;
  const pending = !!(character as any).pending_level_up;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`j-btn !py-1 !px-3 text-xs ${pending ? "lvl-glow" : "j-btn-ghost"}`}
        title={pending ? "Your DM granted a level up!" : "Level up manually"}
      >
        ⬆️ Level Up!
      </button>
      {open && <LevelUpModal character={character} onClose={() => setOpen(false)} onApplied={onApplied} />}
    </>
  );
}
