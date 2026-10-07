import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { totalLevel, type Character } from "@/lib/types";

const db = supabase as any;

export type EventType = "level_up" | "session" | "death_save" | "npc_met" | "map_discovery" | "milestone";
export const EVENT_META: Record<EventType, { icon: string; color: string; label: string }> = {
  level_up: { icon: "⬆️", color: "#e0b040", label: "Level Up" },
  session: { icon: "📜", color: "#ff6a00", label: "Session" },
  death_save: { icon: "💀", color: "#c43030", label: "Death Save" },
  npc_met: { icon: "👤", color: "#4a8fd8", label: "NPC Met" },
  map_discovery: { icon: "🗺️", color: "#4caf6e", label: "Map Discovery" },
  milestone: { icon: "⭐", color: "#a066d8", label: "Milestone" },
};

type Ev = {
  id: string; character_id: string; event_type: EventType; title: string; description: string;
  linked_session_id: string | null; linked_npc_id: string | null; event_date: string | null;
  level_at: number | null; created_at: string;
};

/** Fire-and-forget helper used by other features to log an event. */
export async function logCharacterEvent(e: {
  character_id: string; event_type: EventType; title: string; description?: string;
  linked_session_id?: string | null; linked_npc_id?: string | null; level_at?: number | null;
}) {
  await db.from("character_events").insert({ description: "", ...e });
}

export function CharacterTimeline({ character, readOnly }: { character: Character; readOnly: boolean }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<Ev[]>([]);
  const [sessions, setSessions] = useState<Record<string, string>>({});
  const [npcs, setNpcs] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<Ev | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ event_type: "milestone" as EventType, title: "", description: "", event_date: "", linked_session_id: "", linked_npc_id: "" });

  async function load() {
    const [e, s, n] = await Promise.all([
      db.from("character_events").select("*").eq("character_id", character.id).order("created_at"),
      db.from("sessions").select("id,title,session_number").eq("character_id", character.id).order("session_number"),
      db.from("npcs").select("id,name").eq("character_id", character.id),
    ]);
    setEvents(e.data ?? []);
    setSessions(Object.fromEntries((s.data ?? []).map((x: any) => [x.id, x.title || `Session ${x.session_number}`])));
    setNpcs(Object.fromEntries((n.data ?? []).map((x: any) => [x.id, x.name])));
  }
  useEffect(() => { if (open) load(); }, [open, character.id]);

  async function addEvent() {
    if (!draft.title.trim()) return;
    await db.from("character_events").insert({
      character_id: character.id, event_type: draft.event_type, title: draft.title.trim(),
      description: draft.description, event_date: draft.event_date || null,
      linked_session_id: draft.linked_session_id || null, linked_npc_id: draft.linked_npc_id || null,
      level_at: draft.event_type === "level_up" ? totalLevel(character) : null,
    });
    setAdding(false);
    setDraft({ ...draft, title: "", description: "", event_date: "" });
    load();
  }
  async function remove(id: string) {
    await db.from("character_events").delete().eq("id", id);
    setSel(null); load();
  }

  // Level progress: level after each session, derived from level_up events in order.
  const curLevel = Math.max(1, totalLevel(character));
  const levelUps = events.filter((e) => e.event_type === "level_up");
  const startLevel = Math.max(1, curLevel - levelUps.length);
  const points: { label: string; level: number }[] = [{ label: "Start", level: startLevel }];
  let lvl = startLevel;
  for (const e of events) {
    if (e.event_type === "level_up") lvl = e.level_at ?? lvl + 1;
    if (e.event_type === "session") points.push({ label: e.linked_session_id ? sessions[e.linked_session_id] ?? e.title : e.title, level: lvl });
  }
  points.push({ label: "Now", level: curLevel });

  return (
    <div>
      <button className="w-full flex items-center justify-between j-card !py-3" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="j-h text-xl">📅 Timeline</span>
        <span className="text-[var(--color-muted)] text-sm">{open ? "▾ Hide" : "▸ Show"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {!readOnly && (
            <div className="flex justify-end">
              <button className="j-btn" onClick={() => setAdding(!adding)}>{adding ? "Cancel" : "+ Add Event"}</button>
            </div>
          )}
          {adding && (
            <div className="j-card grid md:grid-cols-2 gap-2">
              <select className="j-input" value={draft.event_type} onChange={(e) => setDraft({ ...draft, event_type: e.target.value as EventType })}>
                {(Object.keys(EVENT_META) as EventType[]).map((t) => <option key={t} value={t}>{EVENT_META[t].icon} {EVENT_META[t].label}</option>)}
              </select>
              <input className="j-input" placeholder="In-game date (optional)" value={draft.event_date} onChange={(e) => setDraft({ ...draft, event_date: e.target.value })} />
              <input className="j-input md:col-span-2" placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <textarea className="j-input md:col-span-2" rows={2} placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <select className="j-input" value={draft.linked_session_id} onChange={(e) => setDraft({ ...draft, linked_session_id: e.target.value })}>
                <option value="">— link session —</option>
                {Object.entries(sessions).map(([id, t]) => <option key={id} value={id}>{t}</option>)}
              </select>
              <select className="j-input" value={draft.linked_npc_id} onChange={(e) => setDraft({ ...draft, linked_npc_id: e.target.value })}>
                <option value="">— link NPC —</option>
                {Object.entries(npcs).map(([id, t]) => <option key={id} value={id}>{t}</option>)}
              </select>
              <button className="j-btn md:col-span-2" onClick={addEvent}>Save Event</button>
            </div>
          )}

          <div className="j-card overflow-x-auto">
            {events.length === 0 ? (
              <div className="italic text-[var(--color-muted)] text-center py-6">Your journey has yet to be written. Events appear here as you level up and play sessions.</div>
            ) : (
              <div className="relative flex items-start gap-10 min-w-max px-4 py-6">
                <div className="absolute left-8 right-8 top-[46px] h-0.5" style={{ background: "linear-gradient(90deg, var(--color-ember), var(--color-flame))", opacity: 0.6 }} />
                {events.map((e) => {
                  const m = EVENT_META[e.event_type];
                  return (
                    <button key={e.id} onClick={() => setSel(e)} className="relative flex flex-col items-center w-24 group">
                      <span className="text-[10px] text-[var(--color-muted)] h-4 truncate w-full text-center">{e.event_date || new Date(e.created_at).toLocaleDateString()}</span>
                      <span className="w-12 h-12 rounded-full flex items-center justify-center text-xl transition group-hover:scale-110"
                        style={{ background: "rgba(16,11,6,0.95)", border: `2px solid ${m.color}`, boxShadow: `0 0 12px -2px ${m.color}` }}>{m.icon}</span>
                      <span className="text-xs mt-2 text-center line-clamp-2">{e.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="j-card">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-2">Level Progress</div>
            <LevelChart points={points} />
          </div>
        </div>
      )}

      {sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSel(null)}>
          <div className="j-page p-5 max-w-md w-full rounded-2xl" onClick={(e) => e.stopPropagation()} style={{ borderColor: EVENT_META[sel.event_type].color }}>
            <div className="flex items-start gap-3">
              <span className="text-3xl">{EVENT_META[sel.event_type].icon}</span>
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-widest" style={{ color: EVENT_META[sel.event_type].color }}>{EVENT_META[sel.event_type].label}</div>
                <div className="j-h text-xl">{sel.title}</div>
                {sel.event_date && <div className="text-xs text-[var(--color-muted)]">{sel.event_date}</div>}
              </div>
              <button onClick={() => setSel(null)} aria-label="Close">✕</button>
            </div>
            {sel.description && <p className="text-sm mt-3 whitespace-pre-wrap">{sel.description}</p>}
            {sel.linked_session_id && sessions[sel.linked_session_id] && <div className="text-xs mt-3">📜 {sessions[sel.linked_session_id]}</div>}
            {sel.linked_npc_id && npcs[sel.linked_npc_id] && <div className="text-xs mt-1">👤 {npcs[sel.linked_npc_id]}</div>}
            {!readOnly && <button className="text-[var(--color-blood)] text-xs mt-4" onClick={() => remove(sel.id)}>Delete event</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function LevelChart({ points }: { points: { label: string; level: number }[] }) {
  const W = 600, H = 180, P = 30;
  const maxL = Math.min(20, Math.max(5, ...points.map((p) => p.level) ) + 1);
  const x = (i: number) => P + (i * (W - P * 2)) / Math.max(1, points.length - 1);
  const y = (l: number) => H - P - ((l - 1) / (maxL - 1)) * (H - P * 2);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.level)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {[1, Math.ceil(maxL / 2), maxL].map((l) => (
        <g key={l}>
          <line x1={P} x2={W - P} y1={y(l)} y2={y(l)} stroke="rgba(255,106,0,0.12)" />
          <text x={P - 8} y={y(l)} textAnchor="end" dominantBaseline="central" fontSize="10" fill="var(--color-muted)">{l}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--color-flame)" strokeWidth={2.5} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.level)} r={4} fill="var(--color-ember)" />
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--color-muted)">{p.label.length > 12 ? p.label.slice(0, 11) + "…" : p.label}</text>
        </g>
      ))}
    </svg>
  );
}
