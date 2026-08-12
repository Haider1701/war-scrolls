export type PinType =
  | "visited" | "discovered" | "dangerous" | "poi" | "home" | "dungeon" | "city" | "mystery";

export type CampaignMap = {
  id: string;
  campaign_id: string;
  name: string;
  image_url: string;
  storage_path?: string | null;
  width_px: number;
  height_px: number;
  is_active: boolean;
  created_at?: string;
};

export type MapPin = {
  id: string;
  map_id: string;
  campaign_id: string;
  x_percent: number;
  y_percent: number;
  label: string;
  description: string;
  pin_type: PinType;
  placed_by: "dm" | "player";
  player_user_id: string | null;
  character_id: string | null;
  session_id: string | null;
  is_visible_to_players: boolean;
  created_at?: string;
};

export const PIN_META: Record<PinType, { label: string; emoji: string; color: string }> = {
  city:      { label: "City / Settlement", emoji: "🏰", color: "#4d9dff" },
  dangerous: { label: "Dangerous",         emoji: "⚔️", color: "#e03a2f" },
  discovered:{ label: "Discovered",        emoji: "👁️", color: "#e8b53a" },
  visited:   { label: "Visited",           emoji: "✅", color: "#4caf50" },
  mystery:   { label: "Mystery",           emoji: "❓", color: "#9b30ff" },
  dungeon:   { label: "Dungeon / Ruins",   emoji: "🏚️", color: "#6b6b6b" },
  home:      { label: "Home Base",         emoji: "🏠", color: "#8fd98f" },
  poi:       { label: "Point of Interest", emoji: "📍", color: "#ff6a00" },
};

export const PIN_TYPES = Object.keys(PIN_META) as PinType[];
/** Pin types a player is allowed to place. */
export const PLAYER_PIN_TYPES: PinType[] = ["visited", "poi"];
