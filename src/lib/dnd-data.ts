// D&D 5e reference data — suggestion lists (users may still type custom values via datalist)

export const DND_CLASSES = [
  "Artificer", "Barbarian", "Bard", "Cleric", "Druid", "Fighter",
  "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard",
  "Blood Hunter",
] as const;

// Hit die per class (D&D 5e SRD)
export const CLASS_HIT_DIE: Record<string, number> = {
  Artificer: 8, Barbarian: 12, Bard: 8, Cleric: 8, Druid: 8, Fighter: 10,
  Monk: 8, Paladin: 10, Ranger: 10, Rogue: 8, Sorcerer: 6, Warlock: 8, Wizard: 6,
  "Blood Hunter": 10,
};

export const DND_RACES = [
  "Human", "Elf", "High Elf", "Wood Elf", "Drow", "Half-Elf",
  "Dwarf", "Hill Dwarf", "Mountain Dwarf", "Halfling", "Lightfoot Halfling", "Stout Halfling",
  "Gnome", "Rock Gnome", "Forest Gnome", "Half-Orc", "Tiefling", "Dragonborn",
  "Aasimar", "Genasi", "Goliath", "Firbolg", "Kenku", "Tabaxi", "Tortle", "Triton",
  "Yuan-ti Pureblood", "Warforged", "Changeling", "Kalashtar", "Shifter",
] as const;

export const DND_BACKGROUNDS = [
  "Acolyte", "Charlatan", "Criminal", "Entertainer", "Folk Hero", "Guild Artisan",
  "Hermit", "Noble", "Outlander", "Sage", "Sailor", "Soldier", "Urchin",
  "Anthropologist", "City Watch", "Clan Crafter", "Cloistered Scholar", "Courtier",
  "Faction Agent", "Far Traveler", "Gladiator", "Haunted One", "Inheritor",
  "Knight", "Mercenary Veteran", "Pirate", "Spy", "Uthgardt Tribe Member",
] as const;

export const DND_ALIGNMENTS = [
  "Lawful Good", "Neutral Good", "Chaotic Good",
  "Lawful Neutral", "True Neutral", "Chaotic Neutral",
  "Lawful Evil", "Neutral Evil", "Chaotic Evil",
  "Unaligned",
] as const;

// Parse "War Cleric 3" → { className: "Cleric", level: 3 }
// Looks for a known class name anywhere in the string; falls back to last word.
export function parseClassString(s?: string | null): { className: string; level: number } {
  if (!s) return { className: "", level: 0 };
  const trimmed = String(s).trim();
  const levelMatch = trimmed.match(/(\d+)\s*$/);
  const level = levelMatch ? parseInt(levelMatch[1], 10) : 0;
  const withoutLevel = levelMatch ? trimmed.slice(0, levelMatch.index).trim() : trimmed;
  // Find any known class name (longest match wins for "Blood Hunter")
  const sorted = [...DND_CLASSES].sort((a, b) => b.length - a.length);
  const found = sorted.find((c) => new RegExp(`\\b${c}\\b`, "i").test(withoutLevel));
  return { className: found ?? withoutLevel, level };
}

/**
 * Compute average HP for a character using standard 5e rules:
 *   Level 1 of primary class: max HD + CON mod
 *   Each subsequent level: avg HD (floor(HD/2)+1) + CON mod
 * Multiclass: level 1 rule applies only to the FIRST class listed.
 */
export function computeAverageHP(
  classLevel: string,
  classLevel2: string | null | undefined,
  conScore: number,
): number {
  const conMod = Math.floor((conScore - 10) / 2);
  const primary = parseClassString(classLevel);
  const secondary = parseClassString(classLevel2 ?? "");

  const primaryHD = CLASS_HIT_DIE[primary.className] ?? 8;
  const secondaryHD = secondary.level > 0 ? (CLASS_HIT_DIE[secondary.className] ?? 8) : 0;

  let hp = 0;
  if (primary.level > 0) {
    hp += primaryHD + conMod; // level 1 max
    const rest = primary.level - 1;
    if (rest > 0) hp += rest * (Math.floor(primaryHD / 2) + 1 + conMod);
  }
  if (secondary.level > 0) {
    // Multiclass levels always use average
    hp += secondary.level * (Math.floor(secondaryHD / 2) + 1 + conMod);
  }
  return Math.max(1, hp);
}
