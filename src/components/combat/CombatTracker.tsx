import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Character } from "@/lib/types";
import type { Combatant, CombatSession } from "@/lib/combatTypes";

const db = supabase as any;
const CONDITIONS = ["Blinded", "Charmed", "Frightened", "Grappled", "Poisoned", "Prone", "Restrained", "Stunned"];

type MemberOption = { player_user_id: string; character_id: string | null; character?: Character };

export function CombatTracker({ campaignId, members }: { campaignId: string; members: MemberOption[] }) {
  const [session, setSession] = useState<CombatSession | null>(null);
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("Goblin");
  const [hp, setHp] = useState(12);
  const [ac, setAc] = useState(13);
  const [initiativeMod, setInitiativeMod] = useState(2);

  const load = useCallback(async () => {
    const { data: sessions } = await db.from("combat_sessions").select("*").eq("campaign_id", campaignId).eq("is_active", true).order("created_at", { ascending: false }).limit(1);
    const active = (sessions?.[0] as CombatSession) ?? null;
    setSession(active);
    if (!active) { setCombatants([]); return; }
    const { data } = await db.from("combat_combatants").select("*").eq("combat_session_id", active.id).order("turn_order");
    setCombatants((data ?? []) as Combatant[]);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel(`combat-dm-${campaignId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "combat_sessions", filter: `campaign_id=eq.${campaignId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "combat_combatants", filter: `campaign_id=eq.${campaignId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [campaignId, load]);

  const selected = combatants.find((c) => c.id === selectedId) ?? null;
  const current = session && combatants.length ? combatants[Math.min(session.current_turn_index, combatants.length - 1)] : null;

  async function begin() {
    await db.from("combat_sessions").update({ is_active: false }).eq("campaign_id", campaignId);
    await db.from("combat_sessions").insert({ campaign_id: campaignId, name: "New Encounter", is_active: true });
    load();
  }

  async function add(values: Partial<Combatant>) {
    if (!session) return;
    await db.from("combat_combatants").insert({
      combat_session_id: session.id, campaign_id: campaignId, name: values.name || "Combatant",
      combatant_type: values.combatant_type || "monster", character_id: values.character_id ?? null,
      player_user_id: values.player_user_id ?? null, hp_current: values.hp_current ?? hp,
      hp_max: values.hp_max ?? hp, ac: values.ac ?? ac, speed: values.speed ?? 30,
      initiative_modifier: values.initiative_modifier ?? initiativeMod, dex_score: values.dex_score ?? 10,
      initiative_roll: 0, turn_order: combatants.length,
    });
    load();
  }

  async function rollAll() {
    const rolled = combatants.map((c) => ({ ...c, initiative_roll: Math.ceil(Math.random() * 20) + c.initiative_modifier }))
      .sort((a, b) => b.initiative_roll - a.initiative_roll || b.dex_score - a.dex_score);
    await Promise.all(rolled.map((c, index) => db.from("combat_combatants").update({ initiative_roll: c.initiative_roll, turn_order: index }).eq("id", c.id)));
    if (session) await db.from("combat_sessions").update({ current_turn_index: 0, round_number: 1 }).eq("id", session.id);
    load();
  }

  async function nextTurn() {
    if (!session || combatants.length === 0) return;
    const wraps = session.current_turn_index >= combatants.length - 1;
    await db.from("combat_sessions").update({ current_turn_index: wraps ? 0 : session.current_turn_index + 1, round_number: wraps ? session.round_number + 1 : session.round_number }).eq("id", session.id);
    load();
  }

  async function patchCombatant(id: string, patch: Partial<Combatant>) {
    await db.from("combat_combatants").update(patch).eq("id", id);
    load();
  }

  if (!session) return (
    <div className="py-16 text-center">
      <div className="text-5xl mb-3">⚔️</div><h3 className="j-h text-xl">The battlefield is quiet</h3>
      <p className="text-sm text-[var(--color-muted)] mt-2 mb-4">Begin an encounter to assemble initiative.</p>
      <button className="j-btn" onClick={begin}>Start Combat</button>
    </div>
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div><div className="text-[10px] uppercase text-[var(--color-muted)]">Active encounter</div><h3 className="j-h text-xl">{session.name}</h3></div>
        <div className="flex-1" />
        <span className="j-card !py-1 !px-3 j-round-flash">Round {session.round_number}</span>
        <button className="j-btn j-btn-ghost !py-1.5" onClick={rollAll}>🎲 Roll All</button>
        <button className="j-btn !py-1.5" onClick={nextTurn}>Next Turn →</button>
        <button className="j-btn j-btn-ghost !py-1.5" onClick={async () => { await db.from("combat_sessions").update({ is_active: false }).eq("id", session.id); load(); }}>End</button>
      </div>
      {current && <div className="j-turn-banner rounded-lg px-4 py-2 text-center"><b>{current.name}</b> is acting now</div>}
      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)] gap-4">
        <div className="space-y-2">
          {combatants.map((c, index) => <button key={c.id} className={`j-combat-row ${current?.id === c.id ? "is-current" : ""} ${selectedId === c.id ? "is-selected" : ""} ${c.is_defeated ? "is-defeated" : ""}`} onClick={() => setSelectedId(c.id)}>
            <span className="w-8 text-center j-glow-text text-lg">{c.initiative_roll || "—"}</span>
            <span className="min-w-0 flex-1"><span className="j-combat-name block truncate">{index + 1}. {c.name}</span><span className="block text-[10px] text-[var(--color-muted)]">AC {c.ac} · HP {c.hp_current}/{c.hp_max}{c.hp_temp ? ` +${c.hp_temp}` : ""}</span></span>
            <span className="text-xs text-[var(--color-muted)]">{c.combatant_type}</span>
          </button>)}
          {combatants.length === 0 && <div className="j-card text-center text-sm italic text-[var(--color-muted)]">Add combatants, then roll initiative.</div>}
        </div>
        <aside className="j-card space-y-3">
          {selected ? <>
            <div className="flex items-center"><h4 className="j-h flex-1">{selected.name}</h4><button className="j-btn j-btn-ghost !p-1.5" aria-label="Remove combatant" onClick={async () => { await db.from("combat_combatants").delete().eq("id", selected.id); setSelectedId(null); load(); }}>🗑️</button></div>
            <div className="grid grid-cols-3 gap-2">
              <NumberField label="HP" value={selected.hp_current} onChange={(v) => patchCombatant(selected.id, { hp_current: v, is_defeated: v <= 0 })} />
              <NumberField label="Temp" value={selected.hp_temp} onChange={(v) => patchCombatant(selected.id, { hp_temp: v })} />
              <NumberField label="AC" value={selected.ac} onChange={(v) => patchCombatant(selected.id, { ac: v })} />
            </div>
            <div><div className="text-[10px] uppercase text-[var(--color-muted)] mb-1">Conditions</div><div className="flex flex-wrap gap-1">{CONDITIONS.map((condition) => { const on = selected.status_conditions.includes(condition); return <button key={condition} className={`j-cond-pill ${on ? "j-glow-text" : "text-[var(--color-muted)]"}`} onClick={() => patchCombatant(selected.id, { status_conditions: on ? selected.status_conditions.filter((x) => x !== condition) : [...selected.status_conditions, condition] })}>{condition}</button>; })}</div></div>
            <button className="j-btn j-btn-ghost w-full" onClick={() => patchCombatant(selected.id, { is_defeated: !selected.is_defeated })}>{selected.is_defeated ? "Restore Combatant" : "Mark Defeated"}</button>
          </> : <>
            <h4 className="j-h">Add combatant</h4>
            <div className="space-y-1">{members.filter((m) => m.character).map((m) => <button key={m.character_id} className="j-btn j-btn-ghost w-full text-left" onClick={() => { const c = m.character; if (!c) return; add({ name: c.name, combatant_type: "player", character_id: c.id, player_user_id: m.player_user_id, hp_current: c.hp_current, hp_max: c.hp_max, ac: c.armor_class, speed: c.speed, initiative_modifier: c.initiative ?? 0 }); }}>＋ {m.character?.name}</button>)}</div>
            <div className="border-t border-[rgba(255,106,0,.2)] pt-3 space-y-2"><input className="j-input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="Monster name" /><div className="grid grid-cols-3 gap-2"><NumberField label="HP" value={hp} onChange={setHp} /><NumberField label="AC" value={ac} onChange={setAc} /><NumberField label="Init" value={initiativeMod} onChange={setInitiativeMod} /></div><button className="j-btn w-full" onClick={() => add({ name, combatant_type: "monster" })}>Add Monster</button></div>
          </>}
        </aside>
      </div>
    </section>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label><span className="text-[9px] uppercase text-[var(--color-muted)]">{label}</span><input className="j-input w-full" type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}