// Simple dice utilities.
export type DieRoll = { die: number; value: number };
export type RollResult = {
  formula: string;
  rolls: DieRoll[];
  modifier: number;
  total: number;
  breakdown: string;
};

export function rollDie(sides: number): number {
  return 1 + Math.floor(Math.random() * sides);
}

// Parse "2d6+3", "1d20-1", "4d8", "d20"
const RE = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i;

export function parseFormula(input: string): { count: number; sides: number; modifier: number } | null {
  const m = input.match(RE);
  if (!m) return null;
  const count = parseInt(m[1] || "1", 10);
  const sides = parseInt(m[2], 10);
  const modifier = m[3] ? parseInt(m[3].replace(/\s+/g, ""), 10) : 0;
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
  return { count, sides, modifier };
}

export function rollFormula(formula: string): RollResult | null {
  const p = parseFormula(formula);
  if (!p) return null;
  const rolls: DieRoll[] = [];
  for (let i = 0; i < p.count; i++) rolls.push({ die: p.sides, value: rollDie(p.sides) });
  const sum = rolls.reduce((a, r) => a + r.value, 0);
  const total = sum + p.modifier;
  const parts = rolls.map((r) => r.value).join("+");
  const mod = p.modifier === 0 ? "" : p.modifier > 0 ? `+${p.modifier}` : `${p.modifier}`;
  return {
    formula,
    rolls,
    modifier: p.modifier,
    total,
    breakdown: p.count === 1 && p.modifier === 0 ? `${rolls[0].value}` : `(${parts})${mod}`,
  };
}

// Extract "+3" or "3" or "-1" as a signed integer
export function parseModifier(text: string): number {
  const m = String(text ?? "").match(/-?\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

// Roll a d20 with optional advantage/disadvantage. Returns picked die + both values.
export function rollD20(mode: "normal" | "adv" | "dis" = "normal"): { picked: number; a: number; b?: number } {
  if (mode === "normal") return { picked: rollDie(20), a: rollDie(20) };
  const a = rollDie(20);
  const b = rollDie(20);
  const picked = mode === "adv" ? Math.max(a, b) : Math.min(a, b);
  return { picked, a, b };
}
