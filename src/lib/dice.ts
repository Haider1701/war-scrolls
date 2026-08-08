// Dice utilities with mixed-formula support ("2d6+1d4+3").
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

// Parse a term "2d6", "d20", "3" (with optional leading sign)
const TERM_RE = /([+-]?)\s*(\d*)d(\d+)|([+-]?)\s*(\d+)/gi;

export type RollMode = "normal" | "adv" | "dis";

export type ModeRoll = {
  mode: RollMode;
  a: number;
  b?: number;
  picked: number;
  /** Sum of the die/dice plus modifier */
  total: number;
  modifier: number;
  sides: number;
  count: number;
  /** e.g. "d8[▲6,3]" or "2d6(4+3)" */
  display: string;
};

const tag = (mode: RollMode) => (mode === "adv" ? "[ADV] " : mode === "dis" ? "[DIS] " : "");
const arrow = (mode: RollMode) => (mode === "adv" ? "▲" : "▼");

/** THE single shared advantage/disadvantage roller. Used by every die button and formula token. */
export function rollWithMode(sides: number, modifier = 0, mode: RollMode = "normal", count = 1): ModeRoll {
  const rollSet = () => {
    let sum = 0;
    for (let i = 0; i < count; i++) sum += rollDie(sides);
    return sum;
  };
  const label = `${count > 1 ? count : ""}d${sides}`;
  if (mode === "normal") {
    const a = rollSet();
    return { mode, a, picked: a, total: a + modifier, modifier, sides, count, display: `${label}[${a}]` };
  }
  const a = rollSet();
  const b = rollSet();
  const picked = mode === "adv" ? Math.max(a, b) : Math.min(a, b);
  const dropped = mode === "adv" ? Math.min(a, b) : Math.max(a, b);
  return {
    mode,
    a,
    b,
    picked,
    total: picked + modifier,
    modifier,
    sides,
    count,
    display: `${tag(mode)}${label}[${arrow(mode)}${picked},${dropped}]`,
  };
}

export function rollFormula(formula: string, mode: RollMode = "normal"): RollResult | null {
  if (!formula || typeof formula !== "string") return null;
  const cleaned = formula.replace(/\s+/g, "");
  if (!cleaned) return null;
  // Validate: only digits, d, +, -
  if (!/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/i.test(cleaned)) return null;

  const rolls: DieRoll[] = [];
  let modifier = 0;
  let sum = 0;
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  TERM_RE.lastIndex = 0;
  while ((m = TERM_RE.exec(cleaned)) !== null) {
    if (m[3]) {
      // dice term
      const sign = m[1] === "-" ? -1 : 1;
      const count = Math.min(100, Math.max(1, parseInt(m[2] || "1", 10)));
      const sides = Math.min(1000, Math.max(2, parseInt(m[3], 10)));
      const r = rollWithMode(sides, 0, mode, count);
      rolls.push({ die: sides, value: r.picked });
      sum += sign * r.picked;
      const body = mode === "normal" ? `${count}d${sides}(${r.picked})` : r.display;
      parts.push(`${sign < 0 ? "-" : parts.length ? "+" : ""}${body}`);
    } else if (m[5]) {
      const sign = m[4] === "-" ? -1 : 1;
      const n = parseInt(m[5], 10) * sign;
      modifier += n;
      parts.push(`${n >= 0 ? (parts.length ? "+" : "") : "-"}${Math.abs(n)}`);
    }
  }

  const total = sum + modifier;
  return {
    formula: cleaned,
    rolls,
    modifier,
    total,
    breakdown: parts.join(""),
  };
}

export function parseModifier(text: string): number {
  const m = String(text ?? "").match(/-?\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

export function rollD20(mode: "normal" | "adv" | "dis" = "normal"): { picked: number; a: number; b?: number } {
  if (mode === "normal") return { picked: rollDie(20), a: rollDie(20) };
  const a = rollDie(20);
  const b = rollDie(20);
  const picked = mode === "adv" ? Math.max(a, b) : Math.min(a, b);
  return { picked, a, b };
}
