import { abilityMod } from "./types";

/** Skill/save modifier = ability mod + proficiency bonus when proficient. */
export const recalcSkillModifier = (score: number, proficient: boolean, prof: number) =>
  abilityMod(score) + (proficient ? prof : 0);

/** Spell save DC = 8 + prof + mod; spell attack = prof + mod. */
export const recalcSpellNumbers = (score: number, prof: number) => ({
  dc: 8 + prof + abilityMod(score),
  attack: prof + abilityMod(score),
});
