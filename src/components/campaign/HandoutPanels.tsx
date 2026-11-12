import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/Toast";

const db = supabase as any;
type Handout = { id: string; campaign_id: string; title: string; handout_type: "letter" | "riddle" | "image" | "note"; content: string | null; image_url: string | null; is_revealed: boolean; revealed_at: string | null; created_at: string; signed_url?: string };
const types: Handout["handout_type"][] = ["letter", "riddle", "image", "note"];

export function DmHandoutPanel({ campaignId }: { campaignId: string }) {
  const [items, setItems] = useState<Handout[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Handout | null | "new">(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const { data, error: queryError } = await db.from("handouts").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false });
    if (queryError) { setError(queryError.message); return; }
    const rows = (data ?? []) as Handout[];
    const withUrls = await Promise.all(rows.map(async (row) => {
      if (!row.image_url) return row;
      const { data: signed } = await supabase.storage.from("handouts").createSignedUrl(row.image_url, 3600);
      return { ...row, signed_url: signed?.signedUrl };
    }));
    setItems(withUrls);
  }, [campaignId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const channel = supabase.channel(`handouts-dm-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "handouts", filter: `campaign_id=eq.${campaignId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [campaignId, load]);

  async function save(draft: { id?: string; title: string; type: Handout["handout_type"]; content: string; file: File | null; imagePath: string | null }) {
    if (!draft.title.trim()) return;
    setBusy(true); setError("");
    let imagePath = draft.imagePath;
    if (draft.file) {
      if (!/^image\/(jpeg|png|webp)$/.test(draft.file.type)) { setError("Choose a JPG, PNG, or WEBP image."); setBusy(false); return; }
      if (draft.file.size > 10 * 1024 * 1024) { setError("Images must be 10 MB or smaller."); setBusy(false); return; }
      const safe = draft.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      imagePath = `${campaignId}/${Date.now()}_${safe}`;
      const { error: uploadError } = await supabase.storage.from("handouts").upload(imagePath, draft.file, { upsert: false, contentType: draft.file.type });
      if (uploadError) { setError(`${uploadError.message} You can retry saving this handout.`); setBusy(false); return; }
    }
    const row = { title: draft.title.trim(), handout_type: draft.type, content: draft.type === "image" ? null : draft.content.trim() || null, image_url: imagePath };
    const result = draft.id
      ? await db.from("handouts").update(row).eq("id", draft.id)
      : await db.from("handouts").insert({ ...row, campaign_id: campaignId });
    if (result.error) {
      if (draft.file && imagePath) await supabase.storage.from("handouts").remove([imagePath]);
      setError(result.error.message); setBusy(false); return;
    }
    await load(); setBusy(false); setEditing(null);
  }
  async function reveal(item: Handout, value: boolean) {
    const { error: updateError } = await db.from("handouts").update({ is_revealed: value, revealed_at: value ? new Date().toISOString() : null }).eq("id", item.id);
    if (updateError) setError(updateError.message); else void load();
  }
  async function remove(item: Handout) {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    if (item.image_url) await supabase.storage.from("handouts").remove([item.image_url]);
    const { error: deleteError } = await db.from("handouts").delete().eq("id", item.id);
    if (deleteError) setError(deleteError.message); else void load();
  }
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center gap-3"><div className="flex-1"><h3 className="j-h text-xl">📨 Handouts</h3><p className="text-xs text-[var(--color-muted)]">Keep a clue hidden until the right moment.</p></div><button className="j-btn" onClick={() => setEditing("new")}>＋ New Handout</button></div>
    {error && <div className="j-affliction text-sm" role="alert">{error}</div>}
    {items.length === 0 ? <div className="j-card py-10 text-center text-sm italic text-[var(--color-muted)]">No handouts yet.</div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className="j-card flex min-h-44 flex-col gap-2">
      {item.signed_url && <img src={item.signed_url} alt={item.title} className="w-full max-h-40 rounded-md object-cover"/>}
      <div className="flex-1"><div className="text-[10px] uppercase text-[var(--color-muted)]">{item.handout_type} · {item.is_revealed ? "Revealed" : "Hidden"}</div><h4 className="j-h text-lg break-words">{item.title}</h4>{item.content && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm">{item.content}</p>}</div>
      {item.is_revealed ? <button className="j-btn j-btn-ghost w-full" onClick={() => void reveal(item, false)}>Hide again</button> : <button className="j-btn w-full" onClick={() => void reveal(item, true)}>✨ Reveal to Players</button>}
      <div className="flex justify-end gap-2"><button className="j-btn j-btn-ghost !py-1" onClick={() => setEditing(item)}>Edit</button><button className="j-btn j-btn-ghost !py-1" onClick={() => void remove(item)}>Delete</button></div>
    </article>)}</div>}
    {editing && <HandoutEditor handout={editing === "new" ? null : editing} busy={busy} onClose={() => setEditing(null)} onSave={save}/>}
  </section>;
}

function HandoutEditor({ handout, busy, onClose, onSave }: { handout: Handout | null; busy: boolean; onClose: () => void; onSave: (d: { id?: string; title: string; type: Handout["handout_type"]; content: string; file: File | null; imagePath: string | null }) => void }) {
  const [title, setTitle] = useState(handout?.title ?? "");
  const [type, setType] = useState<Handout["handout_type"]>(handout?.handout_type ?? "letter");
  const [content, setContent] = useState(handout?.content ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(8,5,2,.78)] p-3" role="dialog" aria-modal="true" aria-label="Handout editor"><div className="j-page w-full max-w-xl max-h-[90vh] overflow-y-auto p-5 space-y-3">
    <div className="flex items-center"><h3 className="j-h text-xl flex-1">{handout ? "Edit Handout" : "New Handout"}</h3><button className="j-btn j-btn-ghost" onClick={onClose} aria-label="Close">✕</button></div>
    <label className="block text-xs text-[var(--color-muted)]">Type<select className="j-input mt-1" value={type} onChange={(e) => setType(e.target.value as Handout["handout_type"])}>{types.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</select></label>
    <label className="block text-xs text-[var(--color-muted)]">Title<input className="j-input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160}/></label>
    {type === "image" ? <label className="block text-xs text-[var(--color-muted)]">Image (JPG, PNG, WEBP · max 10 MB)<input type="file" accept="image/jpeg,image/png,image/webp" className="j-input mt-1" onChange={(e) => setFile(e.target.files?.[0] ?? null)}/>{handout?.image_url && !file && <span className="block mt-1">Existing image is kept unless replaced.</span>}</label> : <label className="block text-xs text-[var(--color-muted)]">Text<textarea className="j-textarea mt-1" rows={7} value={content} onChange={(e) => setContent(e.target.value)}/></label>}
    {busy && <div className="space-y-1 text-xs text-[var(--color-muted)]"><div>Uploading handout…</div><div className="h-1.5 overflow-hidden rounded bg-[rgba(255,106,0,.14)]"><div className="h-full w-1/3 animate-pulse bg-[var(--color-ember)]"/></div></div>}
    <div className="flex justify-end gap-2"><button className="j-btn j-btn-ghost" onClick={onClose}>Cancel</button><button className="j-btn" disabled={busy || !title.trim() || (type === "image" && !file && !handout?.image_url)} onClick={() => onSave({ ...(handout ? { id: handout.id } : {}), title, type, content, file, imagePath: handout?.image_url ?? null })}>{busy ? "Saving…" : "Save Handout"}</button></div>
  </div></div>;
}

export function PlayerHandoutWatcher({ campaignIds, userId }: { campaignIds: string[]; userId: string }) {
  const toast = useToast();
  useEffect(() => {
    if (!campaignIds.length) return;
    const key = `ember-handouts-seen-${userId}`;
    let alive = true;
    let known = new Set<string>();
    let seen = new Set<string>();
    try { seen = new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]); } catch { seen = new Set(); }
    const notify = (count: number) => window.dispatchEvent(new CustomEvent("ember:handout-unread", { detail: count }));
    void db.from("handouts").select("id,title,campaign_id").in("campaign_id", campaignIds).eq("is_revealed", true).then(({ data }: any) => {
      if (!alive) return;
      known = new Set((data ?? []).map((row: { id: string }) => row.id));
      notify([...known].filter((id) => !seen.has(id)).length);
    });
    const channel = supabase.channel(`handouts-player-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "handouts" }, (payload: any) => {
        const row = payload.new as { id?: string; title?: string; campaign_id?: string; is_revealed?: boolean };
        if (!row?.id || !row.campaign_id || !campaignIds.includes(row.campaign_id)) return;
        if (row.is_revealed && !known.has(row.id)) {
          known.add(row.id);
          if (!seen.has(row.id)) { toast(`📨 New handout: ${row.title ?? "A new handout"}`); notify([...known].filter((id) => !seen.has(id)).length); }
        }
        if (payload.eventType === "DELETE" || row.is_revealed === false) known.delete(row.id);
      }).subscribe();
    const markRead = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (!id) return;
      seen.add(id); localStorage.setItem(key, JSON.stringify([...seen]));
      notify([...known].filter((x) => !seen.has(x)).length);
    };
    window.addEventListener("ember:handout-opened", markRead);
    return () => { alive = false; window.removeEventListener("ember:handout-opened", markRead); void supabase.removeChannel(channel); };
  }, [campaignIds.join(","), userId, toast]);
  return null;
}

export function PlayerHandoutPanel({ campaignIds, userId }: { campaignIds: string[]; userId: string }) {
  const [items, setItems] = useState<Handout[]>([]);
  const [open, setOpen] = useState<Handout | null>(null);
  const load = useCallback(async () => {
    if (!campaignIds.length) { setItems([]); return; }
    const { data } = await db.from("handouts").select("*").in("campaign_id", campaignIds).eq("is_revealed", true).order("revealed_at", { ascending: false });
    const rows = (data ?? []) as Handout[];
    const urls = await Promise.all(rows.map(async (row) => {
      if (!row.image_url) return row;
      const { data: signed } = await supabase.storage.from("handouts").createSignedUrl(row.image_url, 3600);
      return { ...row, signed_url: signed?.signedUrl };
    }));
    setItems(urls);
  }, [campaignIds.join(",")]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!campaignIds.length) return;
    const channel = supabase.channel(`handouts-visible-${crypto.randomUUID()}`).on("postgres_changes", { event: "*", schema: "public", table: "handouts" }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [campaignIds.join(","), load]);
  function openItem(item: Handout) { setOpen(item); window.dispatchEvent(new CustomEvent("ember:handout-opened", { detail: item.id })); }
  return <section className="space-y-4"><div><h3 className="j-h text-xl">📨 Handouts</h3><p className="text-xs text-[var(--color-muted)]">Messages and clues revealed by your DM</p></div>
    {items.length === 0 ? <div className="j-card py-10 text-center text-sm italic text-[var(--color-muted)]">No handouts revealed yet.</div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <button key={item.id} className="j-card text-left" onClick={() => openItem(item)}>{item.signed_url && <img src={item.signed_url} alt="" className="mb-2 h-32 w-full rounded object-cover"/>}<div className="text-[10px] uppercase text-[var(--color-muted)]">{item.handout_type}</div><div className="j-h text-lg">{item.title}</div></button>)}</div>}
    {open && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(8,5,2,.84)] p-3" role="dialog" aria-modal="true" aria-label={open.title} onClick={() => setOpen(null)}>{open.image_url ? <div className="relative max-h-[92vh] max-w-5xl" onClick={(e) => e.stopPropagation()}><button className="j-btn absolute -right-3 -top-3 z-10" onClick={() => setOpen(null)} aria-label="Close image">✕</button>{open.signed_url ? <img src={open.signed_url} alt={open.title} className="max-h-[90vh] max-w-full object-contain"/> : <div className="j-card">Image unavailable.</div>}</div> : <div className="j-page max-h-[88vh] w-full max-w-2xl overflow-y-auto p-7" onClick={(e) => e.stopPropagation()}><div className="flex items-center"><div className="j-h text-2xl flex-1">{open.title}</div><button className="j-btn j-btn-ghost" onClick={() => setOpen(null)} aria-label="Close">✕</button></div><div className="j-divider-ornate my-4">✦</div><div className="whitespace-pre-wrap text-base leading-8" style={{ fontFamily: "var(--font-fell)" }}>{open.content}</div></div>}</div>}
  </section>;
}