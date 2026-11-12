import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
type LoreCategory = "location" | "faction" | "deity" | "history" | "item" | "other";
type LorePage = { id: string; campaign_id: string; title: string; category: LoreCategory; content: string; image_url: string | null; is_visible_to_players: boolean; created_at: string; updated_at: string; signed_url?: string };
const categories: LoreCategory[] = ["location", "faction", "deity", "history", "item", "other"];

export function DmLorePanel({ campaignId }: { campaignId: string }) {
  const [pages, setPages] = useState<LorePage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<LorePage | null | "new">(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const { data, error: e } = await db.from("lore_pages").select("*").eq("campaign_id", campaignId).order("category").order("title");
    if (e) { setError(e.message); return; }
    const rows = (data ?? []) as LorePage[];
    const hydrated = await Promise.all(rows.map(async (page) => {
      if (!page.image_url) return page;
      const { data: signed } = await supabase.storage.from("handouts").createSignedUrl(page.image_url, 3600);
      return { ...page, signed_url: signed?.signedUrl };
    }));
    setPages(hydrated);
    setSelectedId((current) => current && hydrated.some((p) => p.id === current) ? current : hydrated[0]?.id ?? null);
  }, [campaignId]);
  useEffect(() => { void load(); }, [load]);
  const selected = pages.find((p) => p.id === selectedId) ?? null;
  const filtered = pages.filter((p) => `${p.title} ${p.category} ${p.content}`.toLowerCase().includes(search.toLowerCase()));
  async function save(draft: { id?: string; title: string; category: LoreCategory; content: string; visible: boolean; file: File | null; imagePath: string | null }) {
    if (!draft.title.trim()) return;
    setError("");
    let path = draft.imagePath;
    if (draft.file) {
      if (!/^image\/(jpeg|png|webp)$/.test(draft.file.type) || draft.file.size > 10 * 1024 * 1024) { setError("Choose a JPG, PNG, or WEBP image under 10 MB."); return; }
      const safe = draft.file.name.replace(/[^a-zA-Z0-9._-]/g, "_"); path = `${campaignId}/${Date.now()}_${safe}`;
      const { error: uploadError } = await supabase.storage.from("handouts").upload(path, draft.file, { contentType: draft.file.type });
      if (uploadError) { setError(`${uploadError.message} You can retry saving this page.`); return; }
    }
    const row = { title: draft.title.trim(), category: draft.category, content: draft.content, image_url: path, is_visible_to_players: draft.visible };
    const result = draft.id ? await db.from("lore_pages").update(row).eq("id", draft.id) : await db.from("lore_pages").insert({ ...row, campaign_id: campaignId }).select("id").single();
    if (result.error) { if (draft.file && path) await supabase.storage.from("handouts").remove([path]); setError(result.error.message); return; }
    await load(); if (!draft.id && result.data?.id) setSelectedId(result.data.id); setEditing(null);
  }
  async function remove(page: LorePage) {
    if (!window.confirm(`Delete “${page.title}”?`)) return;
    if (page.image_url) await supabase.storage.from("handouts").remove([page.image_url]);
    const { error: e } = await db.from("lore_pages").delete().eq("id", page.id);
    if (e) setError(e.message); else await load();
  }
  const titles = useMemo(() => pages.map((p) => p.title), [pages]);
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center gap-3"><div className="flex-1"><h3 className="j-h text-xl">📚 Lore</h3><p className="text-xs text-[var(--color-muted)]">A field guide to your world</p></div><button className="j-btn" onClick={() => setEditing("new")}>＋ New Page</button></div>
    {error && <div role="alert" className="j-affliction text-sm">{error}</div>}
    <div className="grid min-h-[28rem] gap-3 lg:grid-cols-[minmax(210px,.72fr)_minmax(0,2fr)]">
      <aside className="j-card space-y-2"><input aria-label="Search lore" className="j-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lore…"/>{categories.map((category) => { const list = filtered.filter((p) => p.category === category); return list.length ? <div key={category}><div className="mt-2 text-[10px] uppercase text-[var(--color-muted)]">{category}</div>{list.map((page) => <button key={page.id} className={`block w-full truncate rounded px-2 py-1.5 text-left text-sm ${selectedId === page.id ? "j-glow-text bg-[rgba(255,106,0,.1)]" : "text-[var(--color-ink)]"}`} onClick={() => setSelectedId(page.id)}>{page.title}{!page.is_visible_to_players && <span className="ml-1 text-[10px] text-[var(--color-muted)]">🔒</span>}</button>)}</div> : null; })}</aside>
      <article className="j-card min-h-64">{selected ? <><div className="flex flex-wrap items-start gap-2"><div className="min-w-0 flex-1"><div className="text-[10px] uppercase text-[var(--color-muted)]">{selected.category}{selected.is_visible_to_players ? " · Visible to players" : " · DM only"}</div><h4 className="j-h text-2xl break-words">{selected.title}</h4></div><button className="j-btn j-btn-ghost !py-1" onClick={() => setEditing(selected)}>Edit</button><button className="j-btn j-btn-ghost !py-1" onClick={() => void remove(selected)}>Delete</button></div>{selected.signed_url && <img src={selected.signed_url} alt={selected.title} className="mt-3 max-h-72 max-w-full rounded object-cover"/>}<div className="mt-4"><LoreContent content={selected.content} pages={pages} onOpen={(p) => setSelectedId(p.id)}/></div></> : <div className="py-14 text-center text-sm italic text-[var(--color-muted)]">{pages.length ? "Choose an entry from the list." : "No lore pages yet."}</div>}</article>
    </div>
    {editing && <LoreEditor key={editing === "new" ? "new" : editing.id} page={editing === "new" ? null : editing} pages={titles} onClose={() => setEditing(null)} onSave={save}/>}
  </section>;
}

function LoreContent({ content, pages, onOpen }: { content: string; pages: LorePage[]; onOpen: (page: LorePage) => void }) {
  const rendered: ReactNode[] = [];
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (!line.trim()) { rendered.push(<div key={`space-${index}`} className="h-2"/>); return; }
    const parts = line.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*)/g);
    const children = parts.map((part, i) => {
      const match = /^\[\[(.+)\]\]$/.exec(part);
      if (match) { const target = pages.find((p) => p.title.toLowerCase() === match[1].toLowerCase()); return target ? <button key={i} className="j-glow-text underline underline-offset-2" onClick={() => onOpen(target)}>{match[1]}</button> : <span key={i} className="italic text-[var(--color-muted)]">{match[1]}</span>; }
      const bold = /^\*\*(.+)\*\*$/.exec(part);
      return bold ? <strong key={i}>{bold[1]}</strong> : <span key={i}>{part}</span>;
    });
    rendered.push(heading ? <div key={index} className={`j-h ${heading[1].length === 1 ? "text-xl" : "text-lg"}`}>{heading[2]}</div> : <p key={index} className="whitespace-pre-wrap text-sm leading-7">{children}</p>);
  });
  return <div className="space-y-1">{rendered}</div>;
}

function LoreEditor({ page, pages, onClose, onSave }: { page: LorePage | null; pages: string[]; onClose: () => void; onSave: (d: { id?: string; title: string; category: LoreCategory; content: string; visible: boolean; file: File | null; imagePath: string | null }) => void }) {
  const [title, setTitle] = useState(page?.title ?? "");
  const [category, setCategory] = useState<LoreCategory>(page?.category ?? "other");
  const [content, setContent] = useState(page?.content ?? "");
  const [visible, setVisible] = useState(page?.is_visible_to_players ?? false);
  const [preview, setPreview] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); await onSave({ ...(page ? { id: page.id } : {}), title, category, content, visible, file, imagePath: page?.image_url ?? null }); setBusy(false); };
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(8,5,2,.78)] p-3" role="dialog" aria-modal="true" aria-label="Lore page editor"><div className="j-page w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 space-y-3">
    <div className="flex items-center"><h3 className="j-h text-xl flex-1">{page ? "Edit Lore Page" : "New Lore Page"}</h3><button className="j-btn j-btn-ghost" onClick={onClose} aria-label="Close">✕</button></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-[var(--color-muted)]">Title<input className="j-input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140}/></label><label className="text-xs text-[var(--color-muted)]">Category<select className="j-input mt-1" value={category} onChange={(e) => setCategory(e.target.value as LoreCategory)}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></label></div>
    <div className="flex gap-2"><button className={`j-btn ${!preview ? "" : "j-btn-ghost"}`} onClick={() => setPreview(false)}>Write</button><button className={`j-btn ${preview ? "" : "j-btn-ghost"}`} onClick={() => setPreview(true)}>Preview</button></div>
    {preview ? <div className="j-card min-h-48"><LoreContent content={content} pages={[]} onOpen={() => {}}/></div> : <label className="block text-xs text-[var(--color-muted)]">Lore text<textarea className="j-textarea mt-1" rows={11} value={content} onChange={(e) => setContent(e.target.value)} placeholder={`# The Old Quarter\n\nA place older than [[The Crown]].`}/></label>}
    <label className="block text-xs text-[var(--color-muted)]">Optional image (JPG, PNG, WEBP · max 10 MB)<input className="j-input mt-1" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)}/></label>
    <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="accent-[var(--color-ember)]"/>👁 Visible to players</label>
    {pages.length > 0 && <div className="text-[10px] text-[var(--color-muted)]">Link entries with [[Page Title]] · Existing: {pages.join(", ")}</div>}
    <div className="flex justify-end gap-2"><button className="j-btn j-btn-ghost" onClick={onClose}>Cancel</button><button className="j-btn" disabled={busy || !title.trim()} onClick={() => void submit()}>{busy ? "Saving…" : "Save Page"}</button></div>
  </div></div>;
}

export function PlayerLorePanel({ campaignIds }: { campaignIds: string[] }) {
  const [pages, setPages] = useState<LorePage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    if (!campaignIds.length) { setPages([]); return; }
    const { data } = await db.from("lore_pages").select("*").in("campaign_id", campaignIds).eq("is_visible_to_players", true).order("category").order("title");
    const rows = (data ?? []) as LorePage[];
    const hydrated = await Promise.all(rows.map(async (p) => {
      if (!p.image_url) return p;
      const { data: signed } = await supabase.storage.from("handouts").createSignedUrl(p.image_url, 3600);
      return { ...p, signed_url: signed?.signedUrl };
    }));
    setPages(hydrated); setSelectedId((id) => id && hydrated.some((p) => p.id === id) ? id : hydrated[0]?.id ?? null);
  }, [campaignIds.join(",")]);
  useEffect(() => { void load(); }, [load]);
  const selected = pages.find((p) => p.id === selectedId) ?? null;
  const filtered = pages.filter((p) => `${p.title} ${p.category} ${p.content}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="space-y-3"><div><h3 className="j-h text-xl">📚 Lore</h3><p className="text-xs text-[var(--color-muted)]">The stories and places of your campaigns</p></div>{pages.length === 0 ? <div className="j-card py-10 text-center text-sm italic text-[var(--color-muted)]">No lore pages have been revealed.</div> : <div className="grid min-h-[28rem] gap-3 lg:grid-cols-[minmax(210px,.72fr)_minmax(0,2fr)]"><aside className="j-card space-y-2"><input className="j-input" aria-label="Search lore" placeholder="Search lore…" value={search} onChange={(e) => setSearch(e.target.value)}/>{filtered.map((p) => <button key={p.id} className={`block w-full truncate rounded px-2 py-1.5 text-left text-sm ${selectedId === p.id ? "j-glow-text bg-[rgba(255,106,0,.1)]" : ""}`} onClick={() => setSelectedId(p.id)}>{p.title}<span className="ml-1 text-[10px] text-[var(--color-muted)]">{p.category}</span></button>)}</aside><article className="j-card">{selected ? <><div className="text-[10px] uppercase text-[var(--color-muted)]">{selected.category}</div><h4 className="j-h text-2xl">{selected.title}</h4>{selected.signed_url && <img src={selected.signed_url} alt={selected.title} className="mt-3 max-h-72 rounded object-cover"/>}<div className="mt-4"><LoreContent content={selected.content} pages={pages} onOpen={(p) => setSelectedId(p.id)}/></div></> : <p className="text-sm italic text-[var(--color-muted)]">No matching entries.</p>}</article></div>}</section>;
}