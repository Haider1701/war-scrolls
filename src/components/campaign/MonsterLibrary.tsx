import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Character } from "@/lib/types";
import { parseLevel } from "@/lib/types";
import { encounterDifficulty } from "@/lib/encounterMath";

const db = supabase as any;
type Monster = { slug: string; name: string; size: string; type: string; subtype?: string | null; challenge_rating: string; xp: number; armor_class: number | number[]; hit_points: number; speed: Record<string, unknown>; strength: number; dexterity: number; constitution: number; intelligence: number; wisdom: number; charisma: number; actions?: { name: string; desc: string }[]; special_abilities?: { name: string; desc: string }[] };
type EncounterRow = { slug: string; name: string; xp: number; quantity: number; hp: number; ac: number; speed: number; dexterity: number; color: string };
const colors = ["#c0392b", "#d35400", "#2980b9", "#16a085", "#8e44ad", "#7f8c8d", "#c2185b", "#2e7d32"];
const localCache: { rows: Monster[] | null } = { rows: null };
const modifier = (score: number) => Math.floor((score - 10) / 2);
function xpFromCr(cr: string) { const value: Record<string, number> = { "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000 }; return value[cr] ?? 0; }
function armor(monster: Monster) { return Array.isArray(monster.armor_class) ? Number(monster.armor_class[0] ?? 10) : Number(monster.armor_class ?? 10); }
function speedFeet(monster: Monster) { const val = monster.speed?.walk ?? Object.values(monster.speed ?? {})[0] ?? "30 ft."; const parsed = Number(String(val).match(/\d+/)?.[0]); return Number.isFinite(parsed) ? parsed : 30; }
function scoreText(score: number) { return `${score} (${modifier(score) >= 0 ? "+" : ""}${modifier(score)})`; }

async function fetchMonsters() {
  if (localCache.rows) return localCache.rows;
  const found: Monster[] = [];
  let url: string | null = "https://api.open5e.com/v1/monsters/?limit=100";
  for (let page = 0; url && page < 8; page++) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Monster library returned ${response.status}.`);
    const json = await response.json() as { results?: Monster[]; next?: string | null };
    found.push(...(json.results ?? []).map((monster) => ({ ...monster, xp: monster.xp ?? xpFromCr(monster.challenge_rating) })));
    url = json.next ?? null;
  }
  localCache.rows = found;
  return found;
}

export function MonsterLibrary({ campaignId, members }: { campaignId: string; members: { character?: Character }[] }) {
  const [rows, setRows] = useState<Monster[]>(localCache.rows ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [crFilter, setCrFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [detail, setDetail] = useState<Monster | null>(null);
  const [encounter, setEncounter] = useState<EncounterRow[]>([]);
  const [saved, setSaved] = useState<{ id: string; name: string; monsters: EncounterRow[] }[]>([]);
  const [name, setName] = useState("Untitled Encounter");
  const [averageLevel, setAverageLevel] = useState(0);
  const [partySize, setPartySize] = useState(members.length);
  const [notice, setNotice] = useState("");
  const playerChars = members.map((m) => m.character).filter((c): c is Character => Boolean(c));
  const parsedLevels = playerChars.map((c) => parseLevel(c.class_level) + parseLevel(c.class_level_2));
  const levelsKnown = parsedLevels.length === members.length && parsedLevels.every((v) => v > 0);

  const load = useCallback(async (retry = false) => {
    if (!retry && localCache.rows) { setRows(localCache.rows); return; }
    setLoading(true); setError("");
    try { const data = await fetchMonsters(); setRows(data); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load the monster library."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (!rows.length) void load(); }, [load, rows.length]);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(query.trim().toLowerCase()), 400); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => { if (levelsKnown && parsedLevels.length) setAverageLevel(Math.max(1, Math.round(parsedLevels.reduce((a, b) => a + b, 0) / parsedLevels.length))); }, [levelsKnown, parsedLevels.join(",")]);
  const types = useMemo(() => Array.from(new Set(rows.map((m) => m.type).filter(Boolean))).sort(), [rows]);
  const filtered = useMemo(() => rows.filter((m) => m.name.toLowerCase().includes(debounced) && (typeFilter === "all" || m.type === typeFilter) && (crFilter === "all" || (crFilter === "low" ? Number(m.challenge_rating) <= 1 : crFilter === "mid" ? Number(m.challenge_rating) > 1 && Number(m.challenge_rating) <= 5 : Number(m.challenge_rating) > 5))), [rows, debounced, crFilter, typeFilter]);
  const difficulty = encounterDifficulty(encounter.map((r) => ({ xp: r.xp, quantity: r.quantity })), Array.from({ length: Math.max(0, partySize) }, () => Math.max(1, averageLevel || 1)));

  const addMonster = (monster: Monster) => setEncounter((current) => {
    const exists = current.find((r) => r.slug === monster.slug);
    if (exists) return current.map((r) => r.slug === monster.slug ? { ...r, quantity: r.quantity + 1 } : r);
    return [...current, { slug: monster.slug, name: monster.name, xp: monster.xp ?? xpFromCr(monster.challenge_rating), quantity: 1, hp: monster.hit_points, ac: armor(monster), speed: speedFeet(monster), dexterity: monster.dexterity, color: colors[current.length % colors.length] }];
  });
  async function loadSaved() {
    const { data, error: e } = await db.from("saved_encounters").select("id,name,monsters").eq("campaign_id", campaignId).order("created_at", { ascending: false });
    if (e) { setNotice(e.message); return; }
    setSaved((data ?? []) as typeof saved);
  }
  useEffect(() => { void loadSaved(); }, [campaignId]);
  async function saveEncounter() {
    const { error: e } = await db.from("saved_encounters").insert({ campaign_id: campaignId, name: name.trim() || "Untitled Encounter", monsters: encounter });
    if (e) setNotice(e.message); else { setNotice("Encounter saved."); void loadSaved(); }
  }
  async function deleteSaved(id: string) {
    if (!window.confirm("Delete this saved encounter?")) return;
    const { error: e } = await db.from("saved_encounters").delete().eq("id", id);
    if (e) setNotice(e.message); else void loadSaved();
  }
  async function sendToInitiative() {
    if (!encounter.length) return;
    setNotice("");
    let { data: sessions, error: sessionError } = await db.from("combat_sessions").select("*").eq("campaign_id", campaignId).eq("is_active", true).order("created_at", { ascending: false }).limit(1);
    if (sessionError) { setNotice(sessionError.message); return; }
    let session = sessions?.[0];
    if (!session) {
      const result = await db.from("combat_sessions").insert({ campaign_id: campaignId, name: name.trim() || "New Encounter", is_active: true }).select("*").single();
      if (result.error || !result.data) { setNotice(result.error?.message ?? "Could not start combat."); return; }
      session = result.data;
    }
    const { count } = await db.from("combat_combatants").select("id", { count: "exact", head: true }).eq("combat_session_id", session.id);
    const inserts = encounter.flatMap((monster) => Array.from({ length: monster.quantity }, (_, copy) => ({
      combat_session_id: session.id, campaign_id: campaignId, name: `${monster.name} ${copy + 1}`, combatant_type: "monster", character_id: null, player_user_id: null,
      hp_current: monster.hp, hp_max: monster.hp, hp_temp: 0, ac: monster.ac, speed: monster.speed, initiative_modifier: modifier(monster.dexterity), dex_score: monster.dexterity,
      initiative_roll: 0, turn_order: (count ?? 0) + copy, is_defeated: false, color: monster.color,
    })));
    const { error: addError } = await db.from("combat_combatants").insert(inserts);
    setNotice(addError ? addError.message : `Added ${inserts.length} monsters to the active Initiative Tracker.`);
  }

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center gap-3"><div className="flex-1"><h3 className="j-h text-xl">🐉 Monster Library</h3><p className="text-xs text-[var(--color-muted)]">Open5e bestiary · DM only</p></div><button className="j-btn j-btn-ghost !py-1" onClick={() => void load(true)}>↻ Refresh Library</button></div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.75fr)]">
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_140px]"><input className="j-input" aria-label="Search monsters" placeholder="Search monsters…" value={query} onChange={(e) => setQuery(e.target.value)}/><select className="j-input" aria-label="Challenge rating filter" value={crFilter} onChange={(e) => setCrFilter(e.target.value)}><option value="all">Any CR</option><option value="low">CR 0–1</option><option value="mid">CR 2–5</option><option value="high">CR 6+</option></select><select className="j-input" aria-label="Monster type filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">Any type</option>{types.map((t) => <option key={t}>{t}</option>)}</select></div>
        {loading && <div className="j-card py-8 text-center"><span className="j-spinner"/> Opening the bestiary…</div>}{error && <div className="j-affliction text-sm" role="alert">{error} <button className="ml-2 underline" onClick={() => void load(true)}>Retry</button></div>}
        {!loading && !error && <div className="max-h-[42rem] space-y-2 overflow-auto pr-1">{filtered.slice(0, 100).map((monster) => <button key={monster.slug} onClick={() => setDetail(monster)} className="j-card flex w-full items-center gap-3 text-left transition hover:brightness-125"><div className="min-w-0 flex-1"><div className="j-h truncate">{monster.name}</div><div className="text-xs text-[var(--color-muted)]">{monster.type} · {monster.size}</div></div><span className="j-cond-pill">CR {monster.challenge_rating}</span><span className="text-xs">HP {monster.hit_points}</span><span className="text-xs">AC {armor(monster)}</span></button>)}{filtered.length === 0 && <div className="j-card py-8 text-center text-sm italic text-[var(--color-muted)]">No monsters match those filters.</div>}</div>}
      </div>
      <aside className="j-card space-y-3 xl:sticky xl:top-4 xl:self-start">
        <div className="flex items-center gap-2"><h4 className="j-h flex-1 text-lg">Encounter Builder</h4><span className="text-xs text-[var(--color-muted)]">{encounter.reduce((n, m) => n + m.quantity, 0)} creatures</span></div>
        <div className="grid grid-cols-2 gap-2"><label className="text-[10px] uppercase text-[var(--color-muted)]">Party size<input className="j-input mt-1" type="number" min={1} max={12} value={partySize} onChange={(e) => setPartySize(Math.max(1, Number(e.target.value)))}/></label><label className="text-[10px] uppercase text-[var(--color-muted)]">Average level<input className="j-input mt-1" type="number" min={1} max={20} value={averageLevel || ""} placeholder={levelsKnown ? "Calculated" : "Set level"} onChange={(e) => setAverageLevel(Math.max(1, Math.min(20, Number(e.target.value))))}/></label></div>
        {!levelsKnown && <p className="text-[10px] text-[var(--color-muted)]">Party levels could not all be read; set the average level for accurate difficulty.</p>}
        {encounter.length ? <div className="max-h-64 space-y-2 overflow-y-auto">{encounter.map((monster) => <div key={monster.slug} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate">{monster.name}</span><button className="j-btn j-btn-ghost !p-1" aria-label={`Remove one ${monster.name}`} onClick={() => setEncounter((current) => current.flatMap((m) => m.slug !== monster.slug ? [m] : m.quantity > 1 ? [{ ...m, quantity: m.quantity - 1 }] : []))}>−</button><span className="w-5 text-center">{monster.quantity}</span><button className="j-btn j-btn-ghost !p-1" aria-label={`Add one ${monster.name}`} onClick={() => setEncounter((current) => current.map((m) => m.slug === monster.slug ? { ...m, quantity: m.quantity + 1 } : m))}>＋</button><span className="w-14 text-right text-[10px] text-[var(--color-muted)]">{monster.xp} XP</span></div>)}</div> : <div className="rounded-md border border-dashed border-[rgba(255,106,0,.3)] py-6 text-center text-xs text-[var(--color-muted)]">Choose a monster to begin.</div>}
        <div className="j-card !p-3 text-sm"><div className="flex justify-between"><span>Base XP</span><b>{difficulty.baseXp.toLocaleString()}</b></div><div className="flex justify-between"><span>Adjusted XP · ×{difficulty.multiplier}</span><b>{difficulty.adjustedXp.toLocaleString()}</b></div><div className="mt-1 text-right j-glow-text">{difficulty.difficulty}</div></div>
        <input className="j-input" aria-label="Encounter name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)}/><div className="grid grid-cols-2 gap-2"><button className="j-btn j-btn-ghost !px-2" disabled={!encounter.length} onClick={() => void saveEncounter()}>💾 Save Encounter</button><button className="j-btn !px-2" disabled={!encounter.length} onClick={() => void sendToInitiative()}>🎲 Send to Initiative</button></div>
        {notice && <p role="status" className="text-xs text-[var(--color-muted)]">{notice}</p>}
        {saved.length > 0 && <div className="space-y-1 border-t border-[rgba(255,106,0,.2)] pt-2"><div className="text-[10px] uppercase text-[var(--color-muted)]">Saved encounters</div>{saved.map((entry) => <div key={entry.id} className="flex items-center gap-2"><button className="min-w-0 flex-1 truncate text-left text-xs hover:text-[var(--color-flame)]" onClick={() => { setName(entry.name); setEncounter(entry.monsters); }}>{entry.name}</button><button className="j-btn j-btn-ghost !p-1" aria-label={`Delete ${entry.name}`} onClick={() => void deleteSaved(entry.id)}>🗑</button></div>)}</div>}
      </aside>
    </div>
    {detail && <MonsterDetail monster={detail} onClose={() => setDetail(null)} onAdd={() => { addMonster(detail); setNotice(`${detail.name} added to the encounter.`); }} onCombat={() => { addMonster(detail); setNotice(`${detail.name} queued. Use Send to Initiative to add the encounter.`); }}/ >}
  </section>;
}

function MonsterDetail({ monster, onClose, onAdd, onCombat }: { monster: Monster; onClose: () => void; onAdd: () => void; onCombat: () => void }) {
  const abilities: [string, number][] = [["STR", monster.strength], ["DEX", monster.dexterity], ["CON", monster.constitution], ["INT", monster.intelligence], ["WIS", monster.wisdom], ["CHA", monster.charisma]];
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(8,5,2,.8)] p-3" role="dialog" aria-modal="true" aria-label={`${monster.name} stat block`} onClick={onClose}><div className="j-page max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 space-y-3" onClick={(e) => e.stopPropagation()}><div className="flex items-start"><div className="min-w-0 flex-1"><div className="text-xs text-[var(--color-muted)]">{monster.size} {monster.type} · CR {monster.challenge_rating} · {monster.xp.toLocaleString()} XP</div><h3 className="j-h text-2xl">{monster.name}</h3></div><button className="j-btn j-btn-ghost" onClick={onClose} aria-label="Close">✕</button></div><div className="grid grid-cols-3 gap-2 text-sm"><div className="j-card">AC <b>{armor(monster)}</b></div><div className="j-card">HP <b>{monster.hit_points}</b></div><div className="j-card">Speed <b>{speedFeet(monster)} ft</b></div></div><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{abilities.map(([name, score]) => <div key={name} className="j-card !p-2 text-center"><div className="text-[10px] text-[var(--color-muted)]">{name}</div><b>{scoreText(score)}</b></div>)}</div>{monster.special_abilities?.map((ability) => <div key={ability.name}><h4 className="j-h">{ability.name}</h4><p className="text-sm">{ability.desc}</p></div>)}{monster.actions?.map((action) => <div key={action.name}><h4 className="j-h">{action.name}</h4><p className="text-sm">{action.desc}</p></div>)}<div className="flex flex-wrap justify-end gap-2"><button className="j-btn j-btn-ghost" onClick={onCombat}>⚔️ Add to Active Combat</button><button className="j-btn" onClick={onAdd}>＋ Add to Encounter</button></div></div></div>;
}