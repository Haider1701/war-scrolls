export type CombatSession = {
  id: string;
  campaign_id: string;
  name: string;
  is_active: boolean;
  current_turn_index: number;
  round_number: number;
  created_at: string;
  updated_at: string;
};

export type Combatant = {
  id: string;
  combat_session_id: string;
  campaign_id: string;
  name: string;
  combatant_type: "player" | "npc" | "monster";
  character_id: string | null;
  player_user_id: string | null;
  initiative_roll: number;
  initiative_modifier: number;
  dex_score: number;
  hp_current: number;
  hp_max: number;
  hp_temp: number;
  ac: number;
  speed: number;
  is_defeated: boolean;
  turn_order: number;
  status_conditions: string[];
  concentration_spell: string | null;
  death_save_successes: number;
  death_save_failures: number;
  notes: string;
  color: string;
  created_at: string;
  updated_at: string;
};