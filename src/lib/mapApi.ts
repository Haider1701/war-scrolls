import { supabase } from "@/integrations/supabase/client";
import type { CampaignMap, MapPin } from "./mapTypes";

const db = supabase as any;

/** Private bucket → resolve a temporary display URL for a map image. */
export async function resolveMapUrl(map: CampaignMap): Promise<string> {
  if (map.storage_path) {
    const { data } = await supabase.storage.from("campaign-maps").createSignedUrl(map.storage_path, 60 * 60);
    if (data?.signedUrl) return data.signedUrl;
  }
  return map.image_url;
}

export async function listMaps(campaignId: string): Promise<CampaignMap[]> {
  const { data } = await db
    .from("campaign_maps")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  return (data ?? []) as CampaignMap[];
}

export async function listPins(mapId: string): Promise<MapPin[]> {
  const { data } = await db
    .from("map_pins")
    .select("*")
    .eq("map_id", mapId)
    .order("created_at", { ascending: true });
  return (data ?? []) as MapPin[];
}

export async function renameMap(mapId: string, name: string) {
  await db.from("campaign_maps").update({ name: name.trim() || "Untitled Map" }).eq("id", mapId);
}

export async function setActiveMap(campaignId: string, mapId: string) {
  await db.from("campaign_maps").update({ is_active: false }).eq("campaign_id", campaignId);
  await db.from("campaign_maps").update({ is_active: true }).eq("id", mapId);
}

export const MAX_MAP_BYTES = 10 * 1024 * 1024;

export async function uploadMap(
  campaignId: string,
  file: File,
  name: string,
): Promise<{ error?: string; map?: CampaignMap }> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return { error: "Use a JPG, PNG or WEBP image." };
  if (file.size > MAX_MAP_BYTES) return { error: "Map image must be under 10 MB." };

  const dims = await new Promise<{ w: number; h: number }>((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ w: 0, h: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${campaignId}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from("campaign-maps").upload(path, file, { contentType: file.type });
  if (up.error) return { error: up.error.message };

  const { data, error } = await db
    .from("campaign_maps")
    .insert({
      campaign_id: campaignId,
      name: name.trim() || file.name.replace(/\.[^.]+$/, ""),
      image_url: path,
      storage_path: path,
      width_px: dims.w,
      height_px: dims.h,
      is_active: false,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  return { map: data as CampaignMap };
}

export async function deleteMap(map: CampaignMap) {
  if (map.storage_path) await supabase.storage.from("campaign-maps").remove([map.storage_path]);
  await db.from("map_pins").delete().eq("map_id", map.id);
  await db.from("campaign_maps").delete().eq("id", map.id);
}
