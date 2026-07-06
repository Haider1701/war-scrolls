import type { CustomTheme, ThemeId } from "./themes";

export type CharacterType = "player" | "npc";

export type Character = {
  id: string;
  user_id: string;
  character_type: CharacterType;
  name: string;
  subtitle: string;
  class_level: string;
  class_level_2: string | null;
  race: string;
  alignment: string;
  background: string;
  proficiency_bonus: number;
  passive_perception: number;
  affliction_note: string;
  image_url: string;
  hp_current: number;
  hp_max: number;
  armor_class: number;
  speed: number;
  languages: string;
  armor_prof: string;
  weapons_prof: string;
  tools_prof: string;
  backstory: string;
  features: { title: string; description: string }[];
  npc_quotes: string;
  npc_actions: string;
  theme?: ThemeId | null;
  custom_theme?: CustomTheme | null;
};

export type CharacterImage = {
  id: string;
  character_id: string;
  image_url: string;
  is_primary: boolean;
  sort_order: number;
  created_at?: string;
};

export const MAX_PLAYERS = 3;
export const MAX_NPCS = 10;
export const MAX_IMAGES = 6;

// Extract trailing integer from strings like "War Cleric 3" -> 3
export const parseLevel = (s?: string | null): number => {
  if (!s) return 0;
  const m = String(s).match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
};
export const totalLevel = (c: Pick<Character, "class_level" | "class_level_2">) =>
  parseLevel(c.class_level) + parseLevel(c.class_level_2);
export const profBonusForLevel = (lvl: number) => 2 + Math.floor((Math.max(1, lvl) - 1) / 4);
export const formatMulticlass = (a?: string | null, b?: string | null) =>
  [a, b].filter((s) => s && String(s).trim().length > 0).join(" / ");

export type Abilities = {
  id?: string;
  character_id: string;
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
};

export type Skill = {
  id: string; character_id: string;
  name: string; modifier: number; proficient: boolean; kind: "skill" | "save";
};

export type Attack = {
  id: string; character_id: string;
  weapon_name: string; attack_bonus: string; damage_dice: string; damage_type: string;
};

export type Spell = {
  id: string; character_id: string;
  spell_level: number;
  name: string; school: string; casting_time: string;
  range: string; components: string; duration: string;
  description: string; upcast_note: string;
  is_homebrew?: boolean;
  gm_approved?: boolean;
  gm_denied?: boolean;
};

export type SpellMeta = {
  id?: string; character_id: string;
  spellcasting_ability: string;
  spell_save_dc: number;
  spell_attack_bonus: number;
  slot_counts: Record<string, number>;
  slots_used: Record<string, number>;
};

export type Session = {
  id: string; character_id: string; created_at?: string;
  session_number: number; title: string; date_played: string;
  notes: string[]; encounter_notes: string;
};

export type Disposition = "ally" | "neutral" | "hostile" | "missing" | "deceased";

export type NPC = {
  id: string; character_id: string;
  name: string; role: string; description: string;
  disposition: Disposition;
  emoji_icon: string;
  session_id?: string | null;
};

export type Equipment = {
  id: string; character_id: string;
  name: string; emoji_icon: string; quantity: number;
};

export type Currency = {
  id?: string; character_id: string;
  cp: number; sp: number; ep: number; gp: number; pp: number;
};

export type Traits = {
  id?: string; character_id: string;
  personality: string; ideal: string; bond: string; flaw: string;
};

export type FreeNotes = { id?: string; character_id: string; content: string };

export type UserProfile = { user_id: string; display_name: string };

export type Campaign = {
  id: string;
  dm_user_id: string;
  name: string;
  description: string | null;
  join_code: string;
  created_at?: string;
};

export type CampaignMember = {
  id: string;
  campaign_id: string;
  player_user_id: string;
  character_id: string | null;
  joined_at?: string;
};

// Membership joined with campaign + DM profile, as fetched for the current player
export type MembershipView = {
  membership: CampaignMember;
  campaign: Campaign;
  dm_display_name: string;
};

export const abilityMod = (score: number) => Math.floor((score - 10) / 2);
export const fmtMod = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export const SKILL_LIST: { name: string; ability: keyof Abilities; emoji: string }[] = [
  { name: "Acrobatics", ability: "dexterity", emoji: "🤸" },
  { name: "Animal Handling", ability: "wisdom", emoji: "🐾" },
  { name: "Arcana", ability: "intelligence", emoji: "🔮" },
  { name: "Athletics", ability: "strength", emoji: "💪" },
  { name: "Deception", ability: "charisma", emoji: "🎭" },
  { name: "History", ability: "intelligence", emoji: "📜" },
  { name: "Insight", ability: "wisdom", emoji: "👁️" },
  { name: "Intimidation", ability: "charisma", emoji: "😠" },
  { name: "Investigation", ability: "intelligence", emoji: "🔍" },
  { name: "Medicine", ability: "wisdom", emoji: "⚕️" },
  { name: "Nature", ability: "wisdom", emoji: "🌿" },
  { name: "Perception", ability: "wisdom", emoji: "👀" },
  { name: "Performance", ability: "charisma", emoji: "🎶" },
  { name: "Persuasion", ability: "charisma", emoji: "💬" },
  { name: "Religion", ability: "intelligence", emoji: "✨" },
  { name: "Sleight of Hand", ability: "dexterity", emoji: "🤲" },
  { name: "Stealth", ability: "dexterity", emoji: "🌑" },
  { name: "Survival", ability: "wisdom", emoji: "🏕️" },
];

export const SAVE_LIST: { name: string; ability: keyof Abilities; emoji: string }[] = [
  { name: "Strength", ability: "strength", emoji: "💪" },
  { name: "Dexterity", ability: "dexterity", emoji: "🏃" },
  { name: "Constitution", ability: "constitution", emoji: "❤️" },
  { name: "Intelligence", ability: "intelligence", emoji: "🧠" },
  { name: "Wisdom", ability: "wisdom", emoji: "🦉" },
  { name: "Charisma", ability: "charisma", emoji: "👑" },
];
