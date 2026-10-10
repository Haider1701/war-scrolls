import { describe, expect, it } from "vitest";
import { recalcSkillModifier, recalcSpellNumbers } from "./levelUpMath";
import { profBonusForLevel } from "./types";

describe("level up recalculation", () => {
  it("proficiency rises to +3 at level 5", () => expect(profBonusForLevel(5)).toBe(3));
  it("proficient skill adds prof", () => expect(recalcSkillModifier(16, true, 3)).toBe(6));
  it("non-proficient skill is ability mod only", () => expect(recalcSkillModifier(16, false, 3)).toBe(3));
  it("spell DC and attack", () => expect(recalcSpellNumbers(18, 3)).toEqual({ dc: 15, attack: 7 }));
});
