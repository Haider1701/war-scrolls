import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PIN_TYPES, type CampaignMap, type MapPin } from "@/lib/mapTypes";
import { deleteMap, listMaps, listPins, renameMap, resolveMapUrl, setActiveMap, uploadMap } from "@/lib/mapApi";
import { MapCanvas } from "./MapCanvas";
import { PinEditor, type SessionOption } from "./PinEditor";

const db = supabase as any;

/** DM-side world map management: upload, switch, activate, and pin editing. */
export function WorldMapPanel({ campaignId, userId }: { campaignId: string; userId: string }) {
  const [maps, setMaps] = useState<CampaignMap[]>([]);
  const [mapId, setMapId] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pins, setPins] = useState<MapPin[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Partial<MapPin> | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const active = maps.find((m) => m.id === mapId) ?? null;

  const loadMaps = useCallback(async () => {
    const list = await listMaps(campaignId);
    setMaps(list);
    setMapId((prev) => (prev && list.some((m) => m.id === prev) ? prev : (list.find((m) => m.is_active) ?? list[0])?.id ?? null));
    const entries = await Promise.all(list.map(async (m) => [m.id, await resolveMapUrl(m)] as const));
    setUrls(Object.fromEntries(entries));
  }, [campaignId]);

  useEffect(() => { loadMaps(); }, [loadMaps]);

  const loadPins = useCallback(async () => {
    if (!mapId) { setPins([]); return; }
    setPins(await listPins(mapId));
  }, [mapId]);

  useEffect(() => { loadPins(); }, [loadPins]);

  // Session options + character name attribution
  useEffect(() => {
    (async () => {
      const { data: mems } = await db.from("campaign_members").select("character_id").eq("campaign_id", campaignId);
      const ids = (mems ?? []).map((m: any) => m.character_id).filter(Boolean) as string[];
      if (ids.length === 0) { setSessions([]); setNames({}); return; }
      const [sess, chars] = await Promise.all([
        db.from("sessions").select("id,title,session_number,character_id").in("character_id", ids).order("session_number"),
        db.from("characters").select("id,name").in("id", ids),
      ]);
      setSessions((sess.data ?? []).map((s: any) => ({ id: s.id, label: s.title || `Session ${s.session_number}` })));
      setNames(Object.fromEntries((chars.data ?? []).map((c: any) => [c.id, c.name])));
    })();
  }, [campaignId]);

  // Realtime pin sync
  useEffect(() => {
    const ch = supabase
      .channel("dm-map-pins-" + campaignId)
      .on("postgres_changes", { event: "*", schema: "public", table: "map_pins", filter: `campaign_id=eq.${campaignId}` }, (payload: any) => {
        const id = (payload.new ?? payload.old)?.id;
        if (payload.eventType === "INSERT" && id) markFresh(id);
        loadPins();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [campaignId, loadPins]);

  function markFresh(id: string) {
    setFresh((f) => [...f, id]);
    window.setTimeout(() => setFresh((f) => f.filter((x) => x !== id)), 3000);
  }

  async function onUpload(file: File) {
    setErr(null);
    setProgress(8);
    const tick = window.setInterval(() => setProgress((p) => (p === null ? p : Math.min(92, p + 7))), 180);
    const res = await uploadMap(campaignId, file, file.name.replace(/\.[^.]+$/, ""));
    window.clearInterval(tick);
    setProgress(100);
    window.setTimeout(() => setProgress(null), 500);
    if (res.error) { setErr(res.error); return; }
    if (res.map) {
      const first = maps.length === 0;
      if (first) await setActiveMap(campaignId, res.map.id);
      await loadMaps();
      setMapId(res.map.id);
    }
  }

  return (
    <section className="space-y-4">
      {/* Upload drop zone */}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onUpload(f);
        }}
        className="w-full rounded-xl px-6 py-7 text-center transition cursor-pointer"
        style={{
          background: dragOver ? "rgba(255,106,0,0.12)" : "rgba(12,9,6,0.55)",
          border: `2px dashed ${dragOver ? "rgba(255,106,0,0.7)" : "rgba(255,106,0,0.3)"}`,
        }}
      >
        <div className="text-3xl">🗺️</div>
        <div className="j-glow-text text-lg mt-1" style={{ fontFamily: "var(--font-uncial)" }}>Drop your map here</div>
        <div className="text-xs text-[var(--color-muted)] mt-0.5">or click to browse</div>
        <div className="text-[10px] text-[var(--color-muted)] mt-1">JPG, PNG or WEBP · max 10 MB</div>
        {progress !== null && (
          <div className="mt-3 h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-full transition-all"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #ff6a00, #ffb347)" }}
            />
          </div>
        )}
      </div>
      {err && <div className="text-xs" style={{ color: "var(--color-blood)" }}>{err}</div>}

      {/* Map thumbnails */}
      {maps.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {maps.map((m) => {
            const sel = m.id === mapId;
            return (
              <div
                key={m.id}
                className="shrink-0 w-48 rounded-xl overflow-hidden"
                style={{
                  background: "rgba(14,10,7,0.8)",
                  border: `1px solid ${m.is_active ? "rgba(255,106,0,0.65)" : sel ? "rgba(255,106,0,0.4)" : "rgba(255,106,0,0.16)"}`,
                  boxShadow: m.is_active ? "0 0 16px -4px var(--color-ember)" : undefined,
                }}
              >
                <button className="block w-full" onClick={() => setMapId(m.id)} aria-label={`Open map ${m.name}`}>
                  {urls[m.id] ? (
                    <img src={urls[m.id]} alt="" className="w-full h-24 object-cover" />
                  ) : (
                    <div className="w-full h-24 flex items-center justify-center text-2xl">🗺️</div>
                  )}
                </button>
                <div className="p-2 space-y-1.5">
                  {renaming === m.id ? (
                    <input
                      autoFocus
                      className="w-full rounded-lg px-2 py-1 text-xs"
                      style={{ background: "rgba(8,6,4,0.7)", border: "1px solid rgba(255,106,0,0.3)", color: "var(--color-ink)" }}
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={async () => { await renameMap(m.id, renameDraft || m.name); setRenaming(null); loadMaps(); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className="text-xs truncate flex-1">{m.name}</div>
                      {m.is_active && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ background: "rgba(50,200,120,0.15)", border: "1px solid rgba(50,200,120,0.35)", color: "rgb(120,220,160)" }}>
                          Active
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1">
                    {!m.is_active && (
                      <button className="j-btn j-btn-ghost !py-0.5 !px-2 text-[10px]"
                        onClick={async () => { await setActiveMap(campaignId, m.id); loadMaps(); }}>
                        Set Active
                      </button>
                    )}
                    <button className="j-btn j-btn-ghost !py-0.5 !px-2 text-[10px]"
                      onClick={() => { setRenaming(m.id); setRenameDraft(m.name); }}>
                      ✏️ Rename
                    </button>
                    <button
                      className="j-btn j-btn-ghost !py-0.5 !px-2 text-[10px]"
                      style={{ color: "var(--color-blood)" }}
                      onClick={async () => {
                        if (!window.confirm(`Delete map "${m.name}" and its pins?`)) return;
                        await deleteMap(m);
                        setMapId(null);
                        loadMaps();
                      }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {active && urls[active.id] && (
        <div className="h-[70vh] min-h-[520px]">
          <MapCanvas
            imageUrl={urls[active.id]}
            pins={pins}
            dmView
            allowPinTool
            freshIds={fresh}
            attributionFor={(p) => (p.placed_by === "player" && p.character_id ? names[p.character_id] : undefined)}
            onRetry={loadMaps}
            onPlace={(x, y) => setEditing({ x_percent: x, y_percent: y, is_visible_to_players: true })}
            onPinClick={(p) => setEditing(p)}
          />
        </div>
      )}

      {editing && active && (
        <PinEditor
          pin={editing}
          allowedTypes={PIN_TYPES}
          sessions={sessions}
          canToggleVisibility
          canEdit
          canDelete={!!editing.id}
          attribution={editing.placed_by === "player" && editing.character_id ? names[editing.character_id] : undefined}
          onClose={() => setEditing(null)}
          onSave={async (d) => {
            if (editing.id) {
              await db.from("map_pins").update(d).eq("id", editing.id);
            } else {
              const { data } = await db.from("map_pins").insert({
                map_id: active.id,
                campaign_id: campaignId,
                x_percent: editing.x_percent,
                y_percent: editing.y_percent,
                placed_by: "dm",
                player_user_id: userId,
                ...d,
              }).select().single();
              if (data?.id) markFresh(data.id);
            }
            setEditing(null);
            loadPins();
          }}
          onDelete={async () => {
            await db.from("map_pins").delete().eq("id", editing.id);
            setEditing(null);
            loadPins();
          }}
        />
      )}
    </section>
  );
}
