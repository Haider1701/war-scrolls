import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
type QuestStatus = "active" | "completed" | "failed";
type Objective = { id: string; quest_id: string; text: string; is_done: boolean; sort_order: number };
type Quest = { id: string; campaign_id: string; title: string; description: string; status: QuestStatus; is_visible_to_players: boolean; reward: string | null; sort_order: number; created_at: string; objectives: Objective[] };
const groups: { status: QuestStatus; title: string; icon: string }[] = [
  { status: "active", title: "Active", icon: "⚑" },
  { status: "completed", title: "Completed", icon: "✓" },
  { status: "failed", title: "Failed", icon: "✕" },
];

export function DmQuestPanel({ campaignId }: { campaignId: string }) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Quest | null | "new">(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await db.from("quests").select("*, quest_objectives(*)").eq("campaign_id", campaignId).order("sort_order").order("created_at");
    setQuests((data ?? []).map((q: any) => ({ ...q, objectives: [...(q.quest_objectives ?? [])].sort((a: Objective, b: Objective) => a.sort_order - b.sort_order) })));
    setLoading(false);
  }, [campaignId]);
  useEffect(() => { setLoading(true); void load(); }, [load]);
  useEffect(() => {
    const channel = supabase.channel(`quests-dm-${campaignId}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quests", filter: `campaign_id=eq.${campaignId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "quest_objectives" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [campaignId, load]);

  async function saveQuest(draft: { id?: string; title: string; description: string; reward: string; objectives: string[] }) {
    if (!draft.title.trim()) return;
    setBusy(true);
    let id = draft.id;
    if (id) {
      const { error } = await db.from("quests").update({ title: draft.title.trim(), description: draft.description.trim(), reward: draft.reward.trim() || null }).eq("id", id);
      if (error) { alert(error.message); setBusy(false); return; }
    } else {
      const { data, error } = await db.from("quests").insert({ campaign_id: campaignId, title: draft.title.trim(), description: draft.description.trim(), reward: draft.reward.trim() || null, sort_order: quests.length }).select("id").single();
      if (error || !data) { alert(error?.message ?? "Could not save quest."); setBusy(false); return; }
      id = data.id;
    }
    if (id) {
      await db.from("quest_objectives").delete().eq("quest_id", id);
      const rows = draft.objectives.map((text, index) => text.trim() ? { quest_id: id, text: text.trim(), sort_order: index } : null).filter(Boolean);
      if (rows.length) await db.from("quest_objectives").insert(rows);
    }
    await load(); setBusy(false); setEditing(null);
  }

  async function updateQuest(id: string, patch: Partial<Quest>) {
    const { error } = await db.from("quests").update(patch).eq("id", id);
    if (error) alert(error.message); else void load();
  }
  async function toggleObjective(objective: Objective) {
    const { error } = await db.from("quest_objectives").update({ is_done: !objective.is_done }).eq("id", objective.id);
    if (error) alert(error.message); else void load();
  }
  async function deleteQuest(quest: Quest) {
    if (!window.confirm(`Delete “${quest.title}” and its objectives?`)) return;
    const { error } = await db.from("quests").delete().eq("id", quest.id);
    if (error) alert(error.message); else void load();
  }

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center gap-3"><div className="flex-1"><h3 className="j-h text-xl">📜 Quest Log</h3><p className="text-xs text-[var(--color-muted)]">Campaign objectives and rewards</p></div><button className="j-btn" onClick={() => setEditing("new")}>＋ New Quest</button></div>
    {loading ? <div className="py-10 text-center text-[var(--color-muted)]"><span className="j-spinner" /> Gathering the scrolls…</div> : groups.map((group) => {
      const list = quests.filter((q) => q.status === group.status);
      return <div key={group.status} className="space-y-2"><h4 className="j-h text-base">{group.icon} {group.title} <span className="text-xs text-[var(--color-muted)]">{list.length}</span></h4>
        {list.length === 0 ? <div className="text-xs italic text-[var(--color-muted)] px-2">No {group.status} quests.</div> : list.map((quest) => <article key={quest.id} className="j-card space-y-3">
          <div className="flex flex-wrap items-start gap-2"><div className="min-w-0 flex-1"><h5 className="j-h text-base break-words">{quest.title}</h5>{quest.description && <p className="text-sm whitespace-pre-wrap mt-1">{quest.description}</p>}</div>
            <select aria-label={`${quest.title} status`} className="j-input !w-auto !py-1 text-xs" value={quest.status} onChange={(e) => void updateQuest(quest.id, { status: e.target.value as QuestStatus })}>{groups.map((g) => <option key={g.status} value={g.status}>{g.title}</option>)}</select>
            <button className="j-btn j-btn-ghost !py-1" title="Edit quest" onClick={() => setEditing(quest)}>✎</button><button className="j-btn j-btn-ghost !py-1" title="Delete quest" onClick={() => void deleteQuest(quest)}>🗑</button></div>
          {quest.reward && <p className="text-xs text-[var(--color-flame)]">Reward · {quest.reward}</p>}
          {quest.objectives.length > 0 && <div className="space-y-1">{quest.objectives.map((objective) => <label key={objective.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={objective.is_done} onChange={() => void toggleObjective(objective)} className="mt-1 accent-[var(--color-ember)]"/><span className={objective.is_done ? "line-through opacity-60" : ""}>{objective.text}</span></label>)}<div className="text-[10px] uppercase text-[var(--color-muted)]">{quest.objectives.filter((o) => o.is_done).length}/{quest.objectives.length} objectives</div></div>}
          <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]"><input type="checkbox" checked={quest.is_visible_to_players} onChange={(e) => void updateQuest(quest.id, { is_visible_to_players: e.target.checked })} className="accent-[var(--color-ember)]"/>👁 Visible to players</label>
        </article>)}
      </div>;
    })}
    {editing && <QuestEditor quest={editing === "new" ? null : editing} busy={busy} onClose={() => setEditing(null)} onSave={saveQuest}/>}
  </section>;
}

function QuestEditor({ quest, busy, onClose, onSave }: { quest: Quest | null; busy: boolean; onClose: () => void; onSave: (d: { id?: string; title: string; description: string; reward: string; objectives: string[] }) => void }) {
  const [title, setTitle] = useState(quest?.title ?? "");
  const [description, setDescription] = useState(quest?.description ?? "");
  const [reward, setReward] = useState(quest?.reward ?? "");
  const [objectives, setObjectives] = useState(quest?.objectives.map((o) => o.text) ?? [""]);
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(8,5,2,.78)] p-3" role="dialog" aria-modal="true" aria-label={quest ? "Edit quest" : "New quest"}><div className="j-page w-full max-w-xl max-h-[90vh] overflow-y-auto p-5 space-y-3">
    <div className="flex items-center"><h3 className="j-h text-xl flex-1">{quest ? "Edit Quest" : "New Quest"}</h3><button className="j-btn j-btn-ghost" onClick={onClose} aria-label="Close">✕</button></div>
    <label className="block text-xs text-[var(--color-muted)]">Title<input autoFocus className="j-input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}/></label>
    <label className="block text-xs text-[var(--color-muted)]">Description<textarea className="j-textarea mt-1" rows={4} value={description} onChange={(e) => setDescription(e.target.value)}/></label>
    <label className="block text-xs text-[var(--color-muted)]">Reward (optional)<input className="j-input mt-1" value={reward} onChange={(e) => setReward(e.target.value)} maxLength={240}/></label>
    <div className="space-y-2"><div className="text-xs text-[var(--color-muted)]">Objectives</div>{objectives.map((value, i) => <div key={i} className="flex gap-2"><input className="j-input" placeholder={`Objective ${i + 1}`} value={value} onChange={(e) => setObjectives((items) => items.map((x, n) => n === i ? e.target.value : x))}/><button className="j-btn j-btn-ghost" onClick={() => setObjectives((items) => items.filter((_, n) => n !== i))} aria-label="Remove objective">−</button></div>)}<button className="j-btn j-btn-ghost !py-1" onClick={() => setObjectives((x) => [...x, ""])}>＋ Objective</button></div>
    <div className="flex justify-end gap-2"><button className="j-btn j-btn-ghost" onClick={onClose}>Cancel</button><button className="j-btn" disabled={busy || !title.trim()} onClick={() => onSave({ ...(quest ? { id: quest.id } : {}), title, description, reward, objectives })}>{busy ? "Saving…" : "Save Quest"}</button></div>
  </div></div>;
}

export function PlayerQuestPanel({ campaignIds }: { campaignIds: string[] }) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!campaignIds.length) { setQuests([]); setLoading(false); return; }
    const { data } = await db.from("quests").select("*, quest_objectives(*)").in("campaign_id", campaignIds).eq("is_visible_to_players", true).order("sort_order").order("created_at");
    setQuests((data ?? []).map((q: any) => ({ ...q, objectives: [...(q.quest_objectives ?? [])].sort((a: Objective, b: Objective) => a.sort_order - b.sort_order) })));
    setLoading(false);
  }, [campaignIds.join(",")]);
  useEffect(() => { setLoading(true); void load(); }, [load]);
  useEffect(() => {
    if (!campaignIds.length) return;
    const key = crypto.randomUUID();
    const channel = supabase.channel(`quests-player-${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quests" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "quest_objectives" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [campaignIds.join(","), load]);
  return <section className="space-y-4"><div><h3 className="j-h text-xl">📜 Quests</h3><p className="text-xs text-[var(--color-muted)]">Your campaign objectives</p></div>
    {loading ? <div className="py-8 text-center text-[var(--color-muted)]"><span className="j-spinner"/></div> : !quests.length ? <div className="j-card py-10 text-center text-sm italic text-[var(--color-muted)]">No active quests yet.</div> : groups.map((group) => { const list = quests.filter((q) => q.status === group.status); return list.length ? <div key={group.status} className="space-y-2"><h4 className="j-h">{group.icon} {group.title}</h4>{list.map((q) => <article key={q.id} className="j-card space-y-2"><h5 className="j-h">{q.title}</h5>{q.description && <p className="text-sm whitespace-pre-wrap">{q.description}</p>}{q.reward && <p className="text-xs text-[var(--color-flame)]">Reward · {q.reward}</p>}{q.objectives.map((o) => <div key={o.id} className={`text-sm ${o.is_done ? "line-through opacity-60" : ""}`}>{o.is_done ? "☑" : "☐"} {o.text}</div>)}<div className="text-[10px] text-[var(--color-muted)]">{q.objectives.filter((o) => o.is_done).length}/{q.objectives.length}</div></article>)}</div> : null; })}
  </section>;
}