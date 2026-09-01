import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PLAYER_PIN_TYPES, type CampaignMap, type MapPin } from "@/lib/mapTypes";
import { listPins, resolveMapUrl } from "@/lib/mapApi";
import { MapCanvas } from "./MapCanvas";
import { PinEditor, type SessionOption } from "./PinEditor";

const db = supabase as any;

/** Player-facing view of the DM's active campaign map. */
export function PlayerMapTab({
  userId, characterId, readOnly, highlightSessionId,
}: {
  userId: string;
  characterId: string;
  readOnly?: boolean;
  highlightSessionId?: string | null;
}) {
  const [map, setMap] = useState<CampaignMap | null>(null);
  const [url, setUrl] = useState("");
  const [pins, setPins] = useState<MapPin[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [editing, setEditing] = useState<Partial<MapPin> | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMap = useCallback(async () => {
    const { data: mems } = await db
      .from("campaign_members").select("campaign_id")
      .eq("player_user_id", userId).eq("character_id", characterId);
    const ids = (mems ?? []).map((m: any) => m.campaign_id);
    if (ids.length === 0) { setMap(null); setLoading(false); return; }
    const { data } = await db
      .from("campaign_maps").select("*").in("campaign_id", ids).eq("is_active", true)
      .order("created_at", { ascending: false }).limit(1);
    setMap((data?.[0] as CampaignMap) ?? null);
    setLoading(false);
  }, [userId, characterId]);

  useEffect(() => { loadMap(); }, [loadMap]);

  useEffect(() => {
    if (!map) { setUrl(""); return; }
    let alive = true;
    resolveMapUrl(map).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [map?.id, map?.storage_path]);

  const loadPins = useCallback(async () => {
    if (!map) { setPins([]); return; }
    setPins(await listPins(map.id));
  }, [map?.id]);

  useEffect(() => { loadPins(); }, [loadPins]);

  useEffect(() => {
    (async () => {
      const { data } = await db.from("sessions").select("id,title,session_number").eq("character_id", characterId).order("session_number");
      setSessions((data ?? []).map((s: any) => ({ id: s.id, label: s.title || `Session ${s.session_number}` })));
    })();
  }, [characterId]);

  useEffect(() => {
    if (!map) return;
    const ch = supabase
      .channel("player-map-pins-" + map.campaign_id)
      .on("postgres_changes", { event: "*", schema: "public", table: "map_pins", filter: `campaign_id=eq.${map.campaign_id}` }, (payload: any) => {
        const id = (payload.new ?? payload.old)?.id;
        if (payload.eventType === "INSERT" && id) {
          setFresh((f) => [...f, id]);
          window.setTimeout(() => setFresh((f) => f.filter((x) => x !== id)), 3000);
        }
        loadPins();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_maps" }, () => loadMap())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [map?.campaign_id, loadPins, loadMap]);

  if (loading) return <div className="text-center text-[var(--color-muted)] italic py-12">Unrolling the map…</div>;
  if (!map) {
    return (
      <div className="text-center text-[var(--color-muted)] italic py-12">
        Your DM hasn’t shared a map yet.
      </div>
    );
  }

  const highlightIds = highlightSessionId ? pins.filter((p) => p.session_id === highlightSessionId).map((p) => p.id) : [];
  const mine = (p: MapPin) => p.placed_by === "player" && p.player_user_id === userId;

  return (
    <div className="j-fade space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="j-h text-xl">{map.name}</div>
        <div className="flex-1" />
        <span className="text-[11px] text-[var(--color-muted)] italic">
          {readOnly ? "Reading mode" : "Click the map to mark a place you’ve visited."}
        </span>
      </div>
      <div className="h-[60vh] min-h-[300px]">
        {url && (
          <MapCanvas
            imageUrl={url}
            pins={pins}
            canPlace={!readOnly}
            freshIds={fresh}
            highlightIds={highlightIds}
            onPlace={(x, y) => setEditing({ x_percent: x, y_percent: y })}
            onPinClick={(p) => setEditing(p)}
          />
        )}
      </div>

      {editing && (
        <PinEditor
          pin={editing}
          allowedTypes={PLAYER_PIN_TYPES}
          sessions={sessions}
          canEdit={!readOnly && (!editing.id || mine(editing as MapPin))}
          canDelete={!readOnly && !!editing.id && mine(editing as MapPin)}
          onClose={() => setEditing(null)}
          onSave={async (d) => {
            if (editing.id) {
              await db.from("map_pins").update(d).eq("id", editing.id);
            } else {
              await db.from("map_pins").insert({
                map_id: map.id,
                campaign_id: map.campaign_id,
                x_percent: editing.x_percent,
                y_percent: editing.y_percent,
                placed_by: "player",
                player_user_id: userId,
                character_id: characterId,
                ...d,
                is_visible_to_players: true,
              });
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
    </div>
  );
}
