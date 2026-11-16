export type MonsterXp = { xp: number; quantity: number };

export const XP_THRESHOLDS: Record<number, [number, number, number, number]> = {
  1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400],
  4: [125, 250, 375, 500], 5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100], 9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400],
  16: [1600, 3200, 4800, 7200], 17: [2000, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700],
};

export function encounterDifficulty(monsters: MonsterXp[], partyLevels: number[]) {
  const baseXp = monsters.reduce((total, monster) => total + monster.xp * Math.max(0, monster.quantity), 0);
  const count = monsters.reduce((total, monster) => total + Math.max(0, monster.quantity), 0);
  const multiplier = count <= 1 ? 1 : count === 2 ? 1.5 : count <= 6 ? 2 : count <= 10 ? 2.5 : count <= 14 ? 3 : 4;
  const adjustedXp = Math.floor(baseXp * multiplier);
  const thresholds = partyLevels.reduce((result, level) => {
    const safeLevel = Math.max(1, Math.min(20, Math.round(level)));
    const row = XP_THRESHOLDS[safeLevel] ?? XP_THRESHOLDS[1];
    return result.map((value, index) => value + row[index]) as [number, number, number, number];
  }, [0, 0, 0, 0] as [number, number, number, number]);
  const difficulty = adjustedXp < thresholds[0] ? "Trivial" : adjustedXp < thresholds[1] ? "Easy" : adjustedXp < thresholds[2] ? "Medium" : adjustedXp < thresholds[3] ? "Hard" : "Deadly";
  return { baseXp, adjustedXp, multiplier, thresholds, difficulty };
}