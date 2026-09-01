import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PIN_TYPES, type CampaignMap, type MapPin } from "@/lib/mapTypes";
import { deleteMap, listMaps, listPins, resolveMapUrl, setActiveMap, uploadMap } from "@/lib/mapApi";
import { MapCanvas } from "./MapCanvas";
import { PinEditor, type SessionOption } from "./PinEditor";

const db = supabase as any;

/** DM-side world map management: upload, switch, activate, and pin editing. */
export function WorldMapPanel({ campaignId, userId }: { campaignId: string; userId: string }) {
  const [maps, setMaps] = useState<CampaignMap[]>([]);
  const [mapId, setMapId] = useState<string | null>(null);
  const [url, setUrl] = useState<string>("");
  const [pins, setPins] = useState<MapPin[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Partial<MapPin> | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const active = maps.find((m) => m.id === mapId) ?? null;

  const loadMaps = useCallback(async () => {
    const list = await listMaps(campaignId);
    setMaps(list);
    setMapId((prev) => (prev && list.some((m) => m.id === prev) ? prev : (list.find((m) => m.is_active) ?? list[0])?.id ?? null));
  }, [campaignId]);

  useEffect(() => { loadMaps(); }, [loadMaps]);

  useEffect(() => {
    if (!active) { setUrl(""); return; }
    let alive = true;
    resolveMapUrl(active).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [active?.id, active?.storage_path]);

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
    setBusy(true); setErr(null);
    const name = window.prompt("Map name", file.name.replace(/\.[^.]+$/, "")) ?? "";
    const res = await uploadMap(campaignId, file, name);
    setBusy(false);
    if (res.error) { setErr(res.error); return; }
    if (res.map) {
      await loadMaps();
      setMapId(res.map.id);
      if (maps.length === 0) await setActiveMap(campaignId, res.map.id).then(loadMaps);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mr-1">World Maps</div>
        {maps.map((m) => (
          <button
            key={m.id}
            onClick={() => setMapId(m.id)}
            className="text-xs px-2.5 py-1 rounded-full transition"
            style={{
              background: m.id === mapId ? "rgba(255,106,0,0.18)" : "rgba(20,15,10,0.7)",
              border: `1px solid ${m.id === mapId ? "rgba(255,106,0,0.5)" : "rgba(255,106,0,0.18)"}`,
            }}
          >
            {m.is_active ? "★ " : ""}{m.name}
          </button>
        ))}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }}
        />
        <button className="j-btn j-btn-ghost !py-1 !px-3 text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "Uploading…" : "+ Upload Map"}
        </button>
      </div>
      {err && <div className="text-xs" style={{ color: "var(--color-blood)" }}>{err}</div>}

      {!active && (
        <div className="rounded-xl p-6 text-center text-xs italic text-[var(--color-muted)]"
          style={{ background: "rgba(20,15,10,0.5)", border: "1px dashed rgba(255,106,0,0.2)" }}>
          No maps yet. Upload a world, city or dungeon map (JPG/PNG, max 10 MB).
        </div>
      )}

      {active && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={active.is_active}
                onChange={async () => {
                  if (active.is_active) {
                    await db.from("campaign_maps").update({ is_active: false }).eq("id", active.id);
                  } else {
                    await setActiveMap(campaignId, active.id);
                  }
                  loadMaps();
                }}
              />
              Active for players
            </label>
            <span className="text-[var(--color-muted)]">· Click the map to place a pin</span>
            <div className="flex-1" />
            <button
              className="j-btn j-btn-ghost !py-1 !px-3 text-xs"
              style={{ color: "var(--color-blood)" }}
              onClick={async () => {
                if (!window.confirm(`Delete map "${active.name}" and its pins?`)) return;
                await deleteMap(active);
                setMapId(null);
                loadMaps();
              }}
            >
              Delete Map
            </button>
          </div>

          <div className="h-[60vh] min-h-[320px]">
            {url && (
              <MapCanvas
                imageUrl={url}
                pins={pins}
                dmView
                canPlace
                freshIds={fresh}
                attributionFor={(p) => (p.placed_by === "player" && p.character_id ? names[p.character_id] : undefined)}
                onPlace={(x, y) => setEditing({ x_percent: x, y_percent: y, is_visible_to_players: true })}
                onPinClick={(p) => setEditing(p)}
              />
            )}
          </div>
        </>
      )}

      {editing && active && (
        <PinEditor
          pin={editing}
          allowedTypes={PIN_TYPES}
          sessions={sessions}
          canToggleVisibility
          canEdit
          canDelete={!!editing.id}
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
