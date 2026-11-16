import { describe, expect, it } from "vitest";
import { encounterDifficulty } from "./encounterMath";

describe("encounterDifficulty", () => {
  it("applies the standard party thresholds to four level-one adventurers", () => {
    expect(encounterDifficulty([{ xp: 50, quantity: 1 }], [1, 1, 1, 1])).toMatchObject({
      baseXp: 50,
      adjustedXp: 50,
      multiplier: 1,
      thresholds: [100, 200, 300, 400],
      difficulty: "Trivial",
    });
  });

  it("uses the standard monster-count multiplier for three monsters", () => {
    expect(encounterDifficulty([{ xp: 100, quantity: 3 }], [3, 3, 3, 3])).toMatchObject({
      baseXp: 300,
      adjustedXp: 600,
      multiplier: 2,
      thresholds: [300, 600, 900, 1600],
      difficulty: "Medium",
    });
  });
});