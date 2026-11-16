import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Character } from "@/lib/types";

const db = supabase as any;
type NpcDraft = { name: string; race: string; role: string; personality: string; quirk: string; secret: string; voice_tip: string; plot_hook: string };
type AiResponse = { error?: string; used?: number; limit?: number; npc?: NpcDraft; text?: string };
const tones = ["Friendly", "Shady", "Heroic", "Comic", "Sinister"];
const styles = ["Dramatic ‘Previously on…’", "Short summary", "Bard’s song-style prose"];

async function callDmAi(mode: "npc" | "recap", input: Record<string, string>): Promise<AiResponse> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch("/api/dm-ai", { method: "POST", headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ mode, input }) });
  const result = await response.json() as AiResponse;
  if (!response.ok) throw new Error(result.error ?? "The writing forge is unavailable. Please retry.");
  return result;
}

function DailyCount({ campaignId }: { campaignId: string }) {
  const [used, setUsed] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await db.from("ai_usage").select("count").eq("user_id", auth.user.id).eq("day", new Date().toISOString().slice(0, 10)).maybeSingle();
      if (alive) setUsed(data?.count ?? 0);
    })();
    const handle = (event: Event) => { const count = (event as CustomEvent<number>).detail; if (typeof count === "number") setUsed(count); };
    window.addEventListener("ember:dm-ai-used", handle);
    return () => { alive = false; window.removeEventListener("ember:dm-ai-used", handle); };
  }, [campaignId]);
  return <span className="text-xs text-[var(--color-muted)]">AI uses today: {used ?? "…"}/20</span>;
}

export function NpcGeneratorButton({ campaignId, characters, onNpcSaved }: { campaignId: string; characters: Character[]; onNpcSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState(tones[0]);
  const [race, setRace] = useState("");
  const [npc, setNpc] = useState<NpcDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [used, setUsed] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  async function generate() {
    setLoading(true); setError(""); setSaved(false);
    try {
      const data = await callDmAi("npc", { campaign_id: campaignId, description, tone, race });
      setNpc(data.npc ?? null); setUsed(data.used ?? null); if (typeof data.used === "number") window.dispatchEvent(new CustomEvent("ember:dm-ai-used", { detail: data.used }));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not generate an NPC. Retry."); }
    finally { setLoading(false); }
  }
  async function saveNpc() {
    if (!npc) return;
    setLoading(true); setError("");
    const descriptionText = [npc.personality && `Personality: ${npc.personality}`, npc.quirk && `Quirk: ${npc.quirk}`, npc.secret && `Secret: ${npc.secret}`, npc.voice_tip && `Voice: ${npc.voice_tip}`, npc.plot_hook && `Plot hook: ${npc.plot_hook}`].filter(Boolean).join("\n\n");
    const target = characters.find((c) => c.character_type === "player") ?? characters[0];
    if (!target) { setError("Create or select a character first so the NPC has a journal to live in."); setLoading(false); return; }
    const { error: saveError } = await db.from("npcs").insert({ character_id: target.id, name: npc.name, role: npc.role, description: descriptionText, disposition: "Unknown", emoji_icon: "🧙" });
    if (saveError) setError(saveError.message); else { setSaved(true); onNpcSaved?.(); }
    setLoading(false);
  }
  if (!open) return <button className="j-btn j-btn-ghost !py-1.5" onClick={() => setOpen(true)}>✨ Generate NPC</button>;
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(8,5,2,.78)] p-3" role="dialog" aria-modal="true" aria-label="Generate NPC"><div className="j-page w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 space-y-3">
    <div className="flex items-center"><h3 className="j-h text-xl flex-1">✨ Generate NPC</h3><DailyCount campaignId={campaignId}/><button className="j-btn j-btn-ghost ml-3" onClick={() => setOpen(false)} aria-label="Close">✕</button></div>
    {!npc ? <><label className="block text-xs text-[var(--color-muted)]">Describe the NPC<textarea className="j-textarea mt-1" rows={3} maxLength={240} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A suspicious tavern owner…"/></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-[var(--color-muted)]">Tone<select className="j-input mt-1" value={tone} onChange={(e) => setTone(e.target.value)}>{tones.map((x) => <option key={x}>{x}</option>)}</select></label><label className="text-xs text-[var(--color-muted)]">Race (optional)<input className="j-input mt-1" value={race} onChange={(e) => setRace(e.target.value)} maxLength={80}/></label></div></> : <div className="j-card space-y-2"><div className="grid gap-2 sm:grid-cols-2">{(["name", "race", "role", "personality", "quirk", "secret", "voice_tip", "plot_hook"] as const).map((field) => <label className="text-xs text-[var(--color-muted)]" key={field}>{field.replaceAll("_", " ")}<textarea className="j-textarea mt-1" rows={field === "personality" || field === "secret" || field === "plot_hook" ? 2 : 1} value={npc[field]} onChange={(e) => setNpc({ ...npc, [field]: e.target.value })}/></label>)}</div></div>}
    {error && <div className="j-affliction text-sm" role="alert">{error}</div>}{saved && <p className="text-sm text-[var(--color-flame)]">Saved to your NPC journal.</p>}
    <div className="flex flex-wrap justify-end gap-2"><button className="j-btn j-btn-ghost" onClick={() => { setOpen(false); setNpc(null); }}>Cancel</button>{npc && <button className="j-btn j-btn-ghost" disabled={loading} onClick={() => void generate()}>🔄 Regenerate</button>}{npc ? <button className="j-btn" disabled={loading} onClick={() => void saveNpc()}>{loading ? "Saving…" : "💾 Save as NPC"}</button> : <button className="j-btn" disabled={loading || !description.trim()} onClick={() => void generate()}>{loading ? "The embers are writing…" : error ? "Retry" : "Generate"}</button>}</div>
  </div></div>;
}

export function RecapGenerator({ campaignId, userId }: { campaignId: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [style, setStyle] = useState(styles[0]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function generate() {
    setLoading(true); setError("");
    try { const result = await callDmAi("recap", { campaign_id: campaignId, description: notes, style }); setText(result.text ?? ""); if (typeof result.used === "number") window.dispatchEvent(new CustomEvent("ember:dm-ai-used", { detail: result.used })); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not generate the recap. Retry."); }
    finally { setLoading(false); }
  }
  async function save() {
    setLoading(true); setError("");
    const { error: e } = await db.from("campaign_journal_entries").insert({ campaign_id: campaignId, entry_type: "session_recap", content: text, status: "approved", author_user_id: userId });
    if (e) setError(e.message); else { setText(""); setNotes(""); setOpen(false); }
    setLoading(false);
  }
  return <><div className="flex flex-wrap items-center gap-2"><DailyCount campaignId={campaignId}/><button className="j-btn j-btn-ghost !py-1.5" onClick={() => setOpen(true)}>✨ Generate Recap</button></div>
    {open && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(8,5,2,.78)] p-3" role="dialog" aria-modal="true" aria-label="Generate session recap"><div className="j-page w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 space-y-3"><div className="flex items-center"><h3 className="j-h text-xl flex-1">✨ Session Recap</h3><DailyCount campaignId={campaignId}/><button className="j-btn j-btn-ghost ml-3" onClick={() => setOpen(false)} aria-label="Close">✕</button></div>
      {!text ? <><label className="block text-xs text-[var(--color-muted)]">Session notes<textarea className="j-textarea mt-1" rows={9} maxLength={3000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste rough notes, memorable moments, or a list of events…"/><span className="block text-right">{notes.length}/3000</span></label><label className="block text-xs text-[var(--color-muted)]">Style<select className="j-input mt-1" value={style} onChange={(e) => setStyle(e.target.value)}>{styles.map((s) => <option key={s}>{s}</option>)}</select></label></> : <label className="block text-xs text-[var(--color-muted)]">Edit recap<textarea className="j-textarea mt-1" rows={12} value={text} onChange={(e) => setText(e.target.value)}/></label>}
      {error && <div className="j-affliction text-sm" role="alert">{error}</div>}
      <div className="flex flex-wrap justify-end gap-2"><button className="j-btn j-btn-ghost" onClick={() => setOpen(false)}>Cancel</button>{text ? <><button className="j-btn j-btn-ghost" disabled={loading} onClick={() => void generate()}>🔄 Regenerate</button><button className="j-btn" disabled={loading} onClick={() => void save()}>{loading ? "Saving…" : "💾 Save to Journal"}</button></> : <button className="j-btn" disabled={loading || !notes.trim()} onClick={() => void generate()}>{loading ? "The embers are writing…" : error ? "Retry" : "Generate Recap"}</button>}</div>
    </div></div>}
  </>;
}

export function CampaignJournal({ campaignId, userId, isDm }: { campaignId: string; userId?: string; isDm: boolean }) {
  const [entries, setEntries] = useState<{ id: string; content: string; created_at: string; entry_type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    void db.from("campaign_journal_entries").select("id,content,created_at,entry_type").eq("campaign_id", campaignId).eq("status", "approved").order("created_at", { ascending: false }).then(({ data }: any) => { if (alive) { setEntries(data ?? []); setLoading(false); } });
    return () => { alive = false; };
  }, [campaignId]);
  return <section className="space-y-4"><div className="flex flex-wrap items-center gap-2"><div className="flex-1"><h3 className="j-h text-lg">Campaign Journal</h3><p className="text-sm text-[var(--color-muted)] mt-1">Shared chronicles from your table.</p></div>{isDm && userId && <RecapGenerator campaignId={campaignId} userId={userId}/>}</div>
    {loading ? <div className="py-8 text-center text-[var(--color-muted)]">Opening the chronicle…</div> : entries.length === 0 ? <div className="j-card py-10 text-center text-sm italic text-[var(--color-muted)]">No shared chronicles yet.</div> : entries.map((entry) => <article key={entry.id} className="j-card"><div className="text-[10px] uppercase text-[var(--color-muted)]">{entry.entry_type.replaceAll("_", " ")} · {new Date(entry.created_at).toLocaleDateString()}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{entry.content}</p></article>)}
  </section>;
}