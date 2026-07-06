import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Currency, Equipment, NPC, Session } from "@/lib/types";

const db = supabase as any;
const DISP: NPC["disposition"][] = ["ally","neutral","hostile","missing"];

type GroupMode = "all" | "by_session";

export function NpcsGearTab({ characterId, readOnly }: { characterId: string; readOnly: boolean }) {
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [gear, setGear] = useState<Equipment[]>([]);
  const [coin, setCoin] = useState<Currency | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [group, setGroup] = useState<GroupMode>("all");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const [n, g, c, s] = await Promise.all([
        db.from("npcs").select("*").eq("character_id", characterId),
        db.from("equipment").select("*").eq("character_id", characterId),
        db.from("currency").select("*").eq("character_id", characterId).maybeSingle(),
        db.from("sessions").select("*").eq("character_id", characterId).order("session_number"),
      ]);
      setNpcs(n.data ?? []);
      setGear(g.data ?? []);
      setCoin(c.data ?? { character_id: characterId, cp:0, sp:0, ep:0, gp:0, pp:0 });
      setSessions(s.data ?? []);
    })();
  }, [characterId]);

  async function addNpc() {
    const { data } = await db.from("npcs").insert({ character_id: characterId, name: "Unknown", role: "", description: "", disposition: "neutral", emoji_icon: "👤" }).select().single();
    if (data) setNpcs([...npcs, data]);
  }
  async function updateNpc(n: NPC, patch: Partial<NPC>) {
    setNpcs(npcs.map((x) => x.id === n.id ? { ...x, ...patch } : x));
    await db.from("npcs").update(patch).eq("id", n.id);
  }
  async function removeNpc(id: string) {
    setNpcs(npcs.filter((n) => n.id !== id));
    await db.from("npcs").delete().eq("id", id);
  }

  async function addGear() {
    const { data } = await db.from("equipment").insert({ character_id: characterId, name: "Item", emoji_icon: "⚔️", quantity: 1 }).select().single();
    if (data) setGear([...gear, data]);
  }
  async function updateGear(g: Equipment, patch: Partial<Equipment>) {
    setGear(gear.map((x) => x.id === g.id ? { ...x, ...patch } : x));
    await db.from("equipment").update(patch).eq("id", g.id);
  }
  async function removeGear(id: string) {
    setGear(gear.filter((g) => g.id !== id));
    await db.from("equipment").delete().eq("id", id);
  }

  async function setCoinField(k: keyof Currency, v: number) {
    if (!coin) return;
    const next = { ...coin, [k]: v };
    setCoin(next);
    await db.from("currency").update({ [k]: v }).eq("character_id", characterId);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; sessionId: string | null; items: NPC[] }>();
    for (const s of sessions) {
      map.set(s.id, { label: `Session ${s.session_number}${s.title ? " — " + s.title : ""}`, sessionId: s.id, items: [] });
    }
    map.set("__unassigned__", { label: "Unassigned", sessionId: null, items: [] });
    for (const n of npcs) {
      const key = n.session_id && map.has(n.session_id) ? n.session_id : "__unassigned__";
      map.get(key)!.items.push(n);
    }
    return Array.from(map.values()).filter((g) => g.items.length > 0);
  }, [npcs, sessions]);

  const renderNpcCard = (n: NPC) => (
    <div key={n.id} className="j-card flex gap-3">
      {readOnly ? <div className="text-4xl">{n.emoji_icon}</div> :
        <input className="text-4xl w-12 text-center bg-transparent outline-none" value={n.emoji_icon} maxLength={4}
          onChange={(e) => updateNpc(n, { emoji_icon: e.target.value })} />}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between gap-2">
          {readOnly ? <div className="j-glow-text" style={{ fontFamily: "var(--font-uncial)" }}>{n.name}</div> :
            <input className="j-input j-glow-text" style={{ fontFamily: "var(--font-uncial)" }} value={n.name} onChange={(e) => updateNpc(n, { name: e.target.value })} />}
          {readOnly ? (
            <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded disposition-${n.disposition}`}>{n.disposition}</span>
          ) : (
            <select className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded disposition-${n.disposition} bg-[var(--color-coal)]`}
              value={n.disposition} onChange={(e) => updateNpc(n, { disposition: e.target.value as any })}>
              {DISP.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>
        {readOnly ? <div className="italic text-sm text-[var(--color-muted)]">{n.role}</div> :
          <input className="j-input italic text-sm" placeholder="role" value={n.role} onChange={(e) => updateNpc(n, { role: e.target.value })} />}
        {readOnly ? <div className="text-sm mt-1">{n.description}</div> :
          <textarea className="bg-transparent w-full outline-none resize-none text-sm mt-1" rows={2}
            placeholder="description" value={n.description} onChange={(e) => updateNpc(n, { description: e.target.value })} />}
        {!readOnly && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Session</span>
            <select
              className="bg-[var(--color-coal)] text-xs rounded px-2 py-1 outline-none border border-[var(--color-ember)]/30"
              value={n.session_id ?? ""}
              onChange={(e) => updateNpc(n, { session_id: e.target.value || null })}
            >
              <option value="">— none —</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  Session {s.session_number}{s.title ? " — " + s.title : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        {readOnly && n.session_id && (
          <div className="mt-2 text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
            {sessions.find((s) => s.id === n.session_id)?.title || `Session ${sessions.find((s) => s.id === n.session_id)?.session_number ?? ""}`}
          </div>
        )}
      </div>
      {!readOnly && <button className="text-[var(--color-blood)] text-xs self-start" onClick={() => removeNpc(n.id)}>✕</button>}
    </div>
  );

  return (
    <div className="j-fade space-y-8">
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="j-h text-xl">👥 Allies & Adversaries</h3>
          <div className="flex items-center gap-2">
            <div className="flex rounded overflow-hidden border border-[var(--color-ember)]/30 text-[10px] uppercase tracking-widest">
              <button
                className={`px-2 py-1 ${group === "all" ? "bg-[var(--color-ember)]/30 text-[var(--color-flame)]" : "text-[var(--color-muted)]"}`}
                onClick={() => setGroup("all")}
              >All</button>
              <button
                className={`px-2 py-1 ${group === "by_session" ? "bg-[var(--color-ember)]/30 text-[var(--color-flame)]" : "text-[var(--color-muted)]"}`}
                onClick={() => setGroup("by_session")}
              >By Session</button>
            </div>
            {!readOnly && <button className="j-btn" onClick={addNpc}>+ NPC</button>}
          </div>
        </div>

        {group === "all" ? (
          <div className="grid md:grid-cols-2 gap-3">
            {npcs.length === 0 && <div className="text-[var(--color-muted)] italic">No souls recorded.</div>}
            {npcs.map(renderNpcCard)}
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.length === 0 && <div className="text-[var(--color-muted)] italic">No souls recorded.</div>}
            {grouped.map((g) => {
              const key = g.sessionId ?? "__unassigned__";
              const open = openGroups[key] !== false;
              return (
                <div key={key} className="j-card !p-3">
                  <button
                    className="w-full flex items-center justify-between text-left"
                    onClick={() => setOpenGroups({ ...openGroups, [key]: !open })}
                  >
                    <span className="j-glow-text" style={{ fontFamily: "var(--font-uncial)" }}>
                      {open ? "▾" : "▸"} {g.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
                      {g.items.length} {g.items.length === 1 ? "soul" : "souls"}
                    </span>
                  </button>
                  {open && (
                    <div className="grid md:grid-cols-2 gap-3 mt-3">
                      {g.items.map(renderNpcCard)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="j-h text-xl">🎒 Equipment</h3>
          {!readOnly && <button className="j-btn" onClick={addGear}>+ Item</button>}
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          {gear.length === 0 && <div className="text-[var(--color-muted)] italic">Empty pack.</div>}
          {gear.map((g) => (
            <div key={g.id} className="j-card flex items-center gap-2 py-2">
              {readOnly ? <span className="text-2xl">{g.emoji_icon}</span> :
                <input className="text-2xl w-10 text-center bg-transparent outline-none" value={g.emoji_icon} maxLength={4} onChange={(e) => updateGear(g, { emoji_icon: e.target.value })} />}
              {readOnly ? <span className="flex-1">{g.name}</span> :
                <input className="j-input flex-1" value={g.name} onChange={(e) => updateGear(g, { name: e.target.value })} />}
              {readOnly ? <span className="text-[var(--color-flame)] font-mono">×{g.quantity}</span> :
                <input type="number" className="j-num !w-14" value={g.quantity} onChange={(e) => updateGear(g, { quantity: parseInt(e.target.value) || 0 })} />}
              {!readOnly && <button className="text-[var(--color-blood)] text-xs" onClick={() => removeGear(g.id)}>✕</button>}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="j-h text-xl mb-3">💰 Coin Purse</h3>
        <div className="flex gap-3 flex-wrap">
          {(["cp","sp","ep","gp","pp"] as const).map((k) => (
            <div key={k} className="flex flex-col items-center gap-1">
              <div className={`coin ${k}`} title={({cp:"Copper",sp:"Silver",ep:"Electrum",gp:"Gold",pp:"Platinum"})[k]}>
                <div className="uppercase">{k}</div>
              </div>
              {readOnly ? <div className="j-glow-text">{coin?.[k] ?? 0}</div> :
                <input type="number" className="j-num" value={coin?.[k] ?? 0} onChange={(e) => setCoinField(k, parseInt(e.target.value) || 0)} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
