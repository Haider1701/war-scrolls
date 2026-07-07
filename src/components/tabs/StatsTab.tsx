import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Abilities, Attack, Character, Skill } from "@/lib/types";
import { SKILL_LIST, SAVE_LIST, abilityMod, fmtMod } from "@/lib/types";
import { useDiceRoller } from "@/components/DiceRoller";
import { parseModifier } from "@/lib/dice";
import { computeAverageHP } from "@/lib/dnd-data";

const db = supabase as any;

const ABILITY_META: { key: keyof Abilities; label: string; emoji: string }[] = [
  { key: "strength", label: "STR", emoji: "💪" },
  { key: "dexterity", label: "DEX", emoji: "🏃" },
  { key: "constitution", label: "CON", emoji: "❤️" },
  { key: "intelligence", label: "INT", emoji: "🧠" },
  { key: "wisdom", label: "WIS", emoji: "🦉" },
  { key: "charisma", label: "CHA", emoji: "👑" },
];

export function StatsTab({ character, onChange, readOnly }: {
  character: Character; onChange: (c: Character) => void; readOnly: boolean;
}) {
  const [abilities, setAbilities] = useState<Abilities | null>(null);
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [skillProf, setSkillProf] = useState<Record<string, Skill>>({});
  const openRoll = useDiceRoller();

  useEffect(() => {
    (async () => {
      const [a, atk, sk] = await Promise.all([
        db.from("ability_scores").select("*").eq("character_id", character.id).maybeSingle(),
        db.from("attacks").select("*").eq("character_id", character.id),
        db.from("skills").select("*").eq("character_id", character.id),
      ]);
      setAbilities(a.data ?? { character_id: character.id, strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 });
      setAttacks(atk.data ?? []);
      const map: Record<string, Skill> = {};
      (sk.data ?? []).forEach((s: Skill) => (map[`${s.kind}:${s.name}`] = s));
      setSkillProf(map);
    })();
  }, [character.id]);

  async function setAbility(k: keyof Abilities, val: number) {
    if (!abilities) return;
    const next = { ...abilities, [k]: val };
    setAbilities(next);
    await db.from("ability_scores").update({ [k]: val }).eq("character_id", character.id);
  }

  async function setHP(field: "hp_current" | "hp_max" | "armor_class" | "speed", val: number) {
    onChange({ ...character, [field]: val });
    await db.from("characters").update({ [field]: val }).eq("id", character.id);
  }

  async function toggleProf(kind: "skill" | "save", name: string) {
    if (readOnly) return;
    const key = `${kind}:${name}`;
    const existing = skillProf[key];
    if (existing) {
      const next = { ...existing, proficient: !existing.proficient };
      setSkillProf({ ...skillProf, [key]: next });
      await db.from("skills").update({ proficient: next.proficient }).eq("id", existing.id);
    } else {
      const { data } = await db.from("skills").insert({
        character_id: character.id, name, kind, proficient: true, modifier: 0,
      }).select().single();
      if (data) setSkillProf({ ...skillProf, [key]: data });
    }
  }

  async function addAttack() {
    const { data } = await db.from("attacks").insert({
      character_id: character.id, weapon_name: "New weapon",
      attack_bonus: "+0", damage_dice: "1d6", damage_type: "",
    }).select().single();
    if (data) setAttacks([...attacks, data]);
  }
  async function updateAttack(a: Attack, patch: Partial<Attack>) {
    const next = { ...a, ...patch };
    setAttacks(attacks.map((x) => x.id === a.id ? next : x));
    await db.from("attacks").update(patch).eq("id", a.id);
  }
  async function removeAttack(id: string) {
    setAttacks(attacks.filter((a) => a.id !== id));
    await db.from("attacks").delete().eq("id", id);
  }

  if (!abilities) return <div className="text-[var(--color-muted)] italic p-6">Kindling…</div>;

  const hpPct = Math.max(0, Math.min(100, (character.hp_current / Math.max(1, character.hp_max)) * 100));

  function ProfRow({ name, ability, emoji, kind }: { name: string; ability: keyof Abilities; emoji: string; kind: "skill" | "save" }) {
    const prof = skillProf[`${kind}:${name}`]?.proficient ?? false;
    const mod = abilityMod((abilities as any)[ability]) + (prof ? character.proficiency_bonus : 0);
    const rollIt = () => openRoll({ kind, label: name, modifier: mod });
    return (
      <div
        className={`flex items-center gap-3 py-1.5 border-b border-[rgba(255,106,0,0.08)] ${readOnly ? "cursor-pointer hover:bg-[rgba(255,106,0,0.08)] rounded px-1 transition" : ""}`}
        onClick={readOnly ? rollIt : undefined}
        title={readOnly ? `Roll ${name} (${fmtMod(mod)})` : undefined}
      >
        <span className={`j-prof-dot ${prof ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); toggleProf(kind, name); }} role={readOnly ? undefined : "button"} />
        <span className="text-[var(--color-flame)] w-10 font-mono">{fmtMod(mod)}</span>
        <span>{emoji}</span>
        <span className="flex-1">{name}</span>
        <span className="text-[var(--color-muted)] text-xs uppercase">{ability.slice(0,3)}</span>
        {readOnly && <span className="text-[var(--color-muted)] text-xs">🎲</span>}
      </div>
    );
  }

  return (
    <div className="j-fade space-y-6">
      <div className="j-card flex flex-wrap items-center gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] flex items-center gap-2">
            Hit Points
            {!readOnly && abilities && (
              <button
                type="button"
                className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-ember)]/40 text-[var(--color-flame)] hover:bg-[var(--color-ember)]/10 transition"
                title="Compute average HP from class levels + CON"
                onClick={async () => {
                  const hp = computeAverageHP(character.class_level, character.class_level_2, abilities.constitution);
                  await setHP("hp_max", hp);
                  await setHP("hp_current", hp);
                }}
              >
                ✨ Auto
              </button>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            {readOnly ? <span className="j-hp text-5xl">{character.hp_current}</span> :
              <input type="number" className="j-num !text-5xl !w-20 j-hp" value={character.hp_current} onChange={(e) => setHP("hp_current", parseInt(e.target.value) || 0)} />}
            <span className="text-[var(--color-muted)]">/</span>
            {readOnly ? <span className="text-2xl">{character.hp_max}</span> :
              <input type="number" className="j-num text-xl" value={character.hp_max} onChange={(e) => setHP("hp_max", parseInt(e.target.value) || 0)} />}
          </div>
          <div className="w-48 h-2 bg-black/60 rounded mt-2 overflow-hidden border border-[rgba(196,48,48,0.4)]">
            <div className="h-full transition-all" style={{ width: `${hpPct}%`, background: "linear-gradient(90deg, #c43030, #ff6a00)" }} />
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">AC</div>
          {readOnly ? <div className="j-h text-3xl">{character.armor_class}</div> :
            <input type="number" className="j-num text-2xl" value={character.armor_class} onChange={(e) => setHP("armor_class", parseInt(e.target.value) || 0)} />}
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Speed</div>
          {readOnly ? <div className="j-h text-2xl">{character.speed} ft</div> :
            <div className="flex items-baseline gap-1 justify-center">
              <input type="number" className="j-num text-xl" value={character.speed} onChange={(e) => setHP("speed", parseInt(e.target.value) || 0)} />
              <span className="text-[var(--color-muted)]">ft</span>
            </div>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {ABILITY_META.map(({ key, label, emoji }) => {
          const score = (abilities as any)[key];
          return (
            <div key={key} className="j-card text-center">
              <div className="text-2xl">{emoji}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">{label}</div>
              <div className="j-h text-3xl my-1">{fmtMod(abilityMod(score))}</div>
              {readOnly ? <div className="text-[var(--color-muted)]">{score}</div> :
                <input type="number" className="j-num" value={score} onChange={(e) => setAbility(key, parseInt(e.target.value) || 0)} />}
            </div>
          );
        })}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="j-h text-xl">⚔ Attacks</h3>
          {!readOnly && <button className="j-btn" onClick={addAttack}>+ Add</button>}
        </div>
        <div className="j-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[var(--color-muted)] text-[10px] uppercase tracking-widest">
              <tr><th className="text-left py-2">Weapon</th><th>Attack</th><th>Damage</th><th>Type</th><th></th></tr>
            </thead>
            <tbody>
              {attacks.length === 0 && (
                <tr><td colSpan={5} className="text-center text-[var(--color-muted)] italic py-4">No weapons recorded</td></tr>
              )}
              {attacks.map((a) => {
                const attackBonus = parseModifier(a.attack_bonus);
                // Extract damage formula: split on space; take first token that looks like NdN
                const dmg = (a.damage_dice || "").trim();
                const rollAttack = () => openRoll({ kind: "attack", label: a.weapon_name || "Attack", attackBonus, damageFormula: dmg || "1d4" });
                return (
                  <tr key={a.id}
                    className={`border-t border-[rgba(255,106,0,0.1)] ${readOnly ? "cursor-pointer hover:bg-[rgba(255,106,0,0.08)] transition" : ""}`}
                    onClick={readOnly ? rollAttack : undefined}
                    title={readOnly ? "Roll attack + damage" : undefined}>
                    <td className="py-2"><input className="j-input" value={a.weapon_name} disabled={readOnly} onChange={(e) => updateAttack(a, { weapon_name: e.target.value })} /></td>
                    <td><input className="j-input text-center" value={a.attack_bonus} disabled={readOnly} onChange={(e) => updateAttack(a, { attack_bonus: e.target.value })} /></td>
                    <td><input className="j-input text-center" value={a.damage_dice} disabled={readOnly} onChange={(e) => updateAttack(a, { damage_dice: e.target.value })} /></td>
                    <td><input className="j-input text-center" value={a.damage_type} disabled={readOnly} onChange={(e) => updateAttack(a, { damage_type: e.target.value })} /></td>
                    <td className="text-right">{readOnly ? <span className="text-[var(--color-muted)] text-xs pr-2">🎲</span> : <button className="text-[var(--color-blood)] px-2" onClick={(e) => { e.stopPropagation(); removeAttack(a.id); }}>✕</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="j-h text-xl mb-2">🛡 Saving Throws</h3>
          <div className="j-card">
            {SAVE_LIST.map((s) => <ProfRow key={s.name} {...s} kind="save" />)}
          </div>
        </div>
        <div>
          <h3 className="j-h text-xl mb-2">📜 Skills</h3>
          <div className="j-card">
            {SKILL_LIST.map((s) => <ProfRow key={s.name} {...s} kind="skill" />)}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {([["languages","Languages"],["armor_prof","Armor"],["weapons_prof","Weapons"],["tools_prof","Tools"]] as const).map(([k, label]) => (
          <div key={k} className="j-card">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">{label}</div>
            {readOnly ? <div>{character[k] || <span className="text-[var(--color-muted)] italic">none</span>}</div> :
              <input className="j-input" value={character[k]} onChange={async (e) => {
                onChange({ ...character, [k]: e.target.value });
                await db.from("characters").update({ [k]: e.target.value }).eq("id", character.id);
              }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
