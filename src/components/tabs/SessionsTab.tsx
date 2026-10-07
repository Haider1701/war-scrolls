import { logCharacterEvent } from "@/components/CharacterTimeline";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { NPC, Session } from "@/lib/types";

const db = supabase as any;

export function SessionsTab({ characterId, readOnly }: { characterId: string; readOnly: boolean }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [pinSessionIds, setPinSessionIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [s, n] = await Promise.all([
        db.from("sessions").select("*").eq("character_id", characterId).order("session_number"),
        db.from("npcs").select("*").eq("character_id", characterId),
      ]);
      setSessions(s.data ?? []);
      setNpcs(n.data ?? []);
      const ids = (s.data ?? []).map((x: Session) => x.id);
      if (ids.length) {
        const { data: pins } = await db.from("map_pins").select("session_id").in("session_id", ids);
        setPinSessionIds(Array.from(new Set(((pins ?? []) as any[]).map((p) => p.session_id).filter(Boolean))));
      }
    })();
  }, [characterId]);

  async function addSession() {
    const next = (sessions[sessions.length - 1]?.session_number ?? 0) + 1;
    const { data } = await db.from("sessions").insert({
      character_id: characterId, session_number: next, title: `Session ${next}`,
      date_played: "", notes: ["","","","",""], encounter_notes: "",
    }).select().single();
    if (data) {
      setSessions([...sessions, data]);
      logCharacterEvent({ character_id: characterId, event_type: "session", title: data.title, linked_session_id: data.id });
    }
  }
  async function update(s: Session, patch: Partial<Session>) {
    setSessions(sessions.map((x) => x.id === s.id ? { ...x, ...patch } : x));
    await db.from("sessions").update(patch).eq("id", s.id);
  }
  async function remove(id: string) {
    setSessions(sessions.filter((s) => s.id !== id));
    await db.from("sessions").delete().eq("id", id);
  }

  return (
    <div className="j-fade space-y-6">
      {sessions.length === 0 && (
        <div className="text-center text-[var(--color-muted)] italic py-12">No sessions logged yet. Forge the first.</div>
      )}
      {sessions.map((s) => (
        <div key={s.id} className="j-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="j-h text-2xl w-12 h-12 rounded-full border border-[var(--color-ember)] flex items-center justify-center" style={{ boxShadow: "0 0 14px var(--color-ember)" }}>
              {s.session_number}
            </div>
            <div className="flex-1">
              {readOnly ? <div className="j-h text-xl">{s.title || `Session ${s.session_number}`}</div> :
                <input className="j-input j-glow-text text-lg" style={{ fontFamily: "var(--font-uncial)" }} value={s.title} onChange={(e) => update(s, { title: e.target.value })} />}
              {readOnly ? <div className="text-[var(--color-muted)] italic text-sm">{s.date_played}</div> :
                <input className="j-input italic text-sm mt-1" placeholder="Date played" value={s.date_played} onChange={(e) => update(s, { date_played: e.target.value })} />}
            </div>
            {pinSessionIds.includes(s.id) && (
              <button
                className="j-btn j-btn-ghost !py-1 !px-2 text-[11px]"
                title="Show this session's places on the campaign map"
                onClick={() => window.dispatchEvent(new CustomEvent("ember:view-on-map", { detail: s.id }))}
              >
                🗺️ View on Map
              </button>
            )}
            {!readOnly && <button className="text-[var(--color-blood)]" onClick={() => remove(s.id)}>✕</button>}
          </div>

          <div className="space-y-1 mb-3">
            {(s.notes ?? []).map((n, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-[var(--color-ember)] mt-0.5">🔥</span>
                {readOnly ? <div className="flex-1">{n || <span className="text-[var(--color-muted)] italic">…</span>}</div> :
                  <input className="j-input flex-1" value={n}
                    onChange={(e) => { const next = [...s.notes]; next[i] = e.target.value; update(s, { notes: next }); }} />}
              </div>
            ))}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Encounter Notes</div>
            {readOnly ? (
              <div className="j-lined j-card whitespace-pre-wrap min-h-[64px]">{s.encounter_notes || <span className="italic text-[var(--color-muted)]">none</span>}</div>
            ) : (
              <textarea className="j-textarea j-lined" rows={4} value={s.encounter_notes} onChange={(e) => update(s, { encounter_notes: e.target.value })} />
            )}
          </div>

          {(() => {
            const met = npcs.filter((n) => n.session_id === s.id);
            if (met.length === 0) return null;
            return (
              <div className="mt-3 pt-3 border-t border-[var(--color-ember)]/20">
                <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-2">👥 NPCs Met</div>
                <div className="flex flex-wrap gap-2">
                  {met.map((n) => (
                    <div key={n.id} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-[var(--color-coal)] border border-[var(--color-ember)]/20">
                      <span>{n.emoji_icon}</span>
                      <span>{n.name}</span>
                      <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded disposition-${n.disposition}`}>{n.disposition}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      ))}
      {!readOnly && <button className="j-btn" onClick={addSession}>+ Add New Session</button>}
    </div>
  );
}
