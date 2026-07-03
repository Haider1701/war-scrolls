import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { rollDie, rollFormula, rollD20 } from "@/lib/dice";

export type RollRequest =
  | { kind: "skill"; label: string; modifier: number }
  | { kind: "save"; label: string; modifier: number }
  | { kind: "attack"; label: string; attackBonus: number; damageFormula: string }
  | { kind: "die"; label: string; sides: number; mode?: "normal" | "adv" | "dis" }
  | { kind: "formula"; label: string; formula: string };

export type Displayed = {
  id: number;
  title: string;
  lines: { label: string; value: string; big?: boolean; crit?: "hit" | "miss" }[];
  summary: string; // one-line summary for logs
};

const Ctx = createContext<(req: RollRequest) => Displayed>(() => ({ id: 0, title: "", lines: [], summary: "" }));
export const useDiceRoller = () => useContext(Ctx);

export function DiceRollerProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Displayed | null>(null);
  const [spin, setSpin] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const closeRef = useRef<number | null>(null);

  const clear = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (closeRef.current) window.clearTimeout(closeRef.current);
    timerRef.current = null; closeRef.current = null;
  };

  const roll = useCallback((req: RollRequest): Displayed => {
    clear();
    // Compute the ACTUAL result once — single source of truth
    const displayed = compute(req);

    // Visual spin phase (does not affect result)
    setActive(null);
    setSpin(rollDie(20));
    const spinTimer = window.setInterval(() => setSpin(rollDie(20)), 45);
    timerRef.current = spinTimer;

    window.setTimeout(() => {
      window.clearInterval(spinTimer);
      timerRef.current = null;
      setActive(displayed);
      setSpin(null);
      closeRef.current = window.setTimeout(() => setActive(null), 3600);
    }, 620);

    return displayed;
  }, []);


  useEffect(() => () => clear(), []);

  const dismiss = () => { clear(); setActive(null); setSpin(null); };

  const dot = useMemo(() => (
    active ? (
      <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto j-page p-6 md:p-8 max-w-sm w-[90%] relative j-fade text-center cursor-pointer" onClick={dismiss}>
          <div className="j-spine" />
          <div className="pl-4">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">{active.title}</div>
            {active.lines.map((l, i) => (
              <div key={i} className={l.big ? "j-h text-4xl md:text-5xl my-2" : "text-lg my-1"}>
                {l.label && <span className="text-[var(--color-muted)] text-sm mr-2">{l.label}</span>}
                <span className={l.crit === "hit" ? "j-glow-text drop-shadow-[0_0_10px_var(--color-flame)]" : l.crit === "miss" ? "text-[var(--color-blood)]" : "j-glow-text"}>
                  {l.value}
                </span>
              </div>
            ))}
            <div className="text-[10px] text-[var(--color-muted)] italic mt-3">tap to dismiss</div>
          </div>
        </div>
      </div>
    ) : spin !== null ? (
      <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
        <div className="j-page p-8 relative j-fade text-center">
          <div className="j-spine" />
          <div className="pl-4">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">rolling…</div>
            <div className="j-h text-6xl my-2 tabular-nums">{spin}</div>
          </div>
        </div>
      </div>
    ) : null
  ), [active, spin]);

  return (
    <Ctx.Provider value={roll}>
      {children}
      {dot}
    </Ctx.Provider>
  );
}

function fmt(n: number) { return n >= 0 ? `+${n}` : `${n}`; }

function compute(req: RollRequest): Displayed {
  if (req.kind === "skill" || req.kind === "save") {
    const d = rollDie(20);
    const total = d + req.modifier;
    return {
      id: Date.now(),
      title: `${req.label} ${req.kind === "save" ? "Save" : "Check"}`,
      lines: [
        { label: "d20", value: `[${d}] ${fmt(req.modifier)} = ${total}` },
        { label: "", value: String(total), big: true },
      ],
      summary: `[${d}]${fmt(req.modifier)} = ${total}`,
    };
  }
  if (req.kind === "die") {
    const mode = req.mode ?? "normal";
    if (req.sides === 20 && mode !== "normal") {
      const r = rollD20(mode);
      return {
        id: Date.now(),
        title: `d20 (${mode === "adv" ? "Advantage" : "Disadvantage"})`,
        lines: [
          { label: "rolls", value: `[${r.a}] · [${r.b}]` },
          { label: mode === "adv" ? "higher" : "lower", value: String(r.picked), big: true },
        ],
        summary: `[${r.a}·${r.b}] → ${r.picked}`,
      };
    }
    const v = rollDie(req.sides);
    return {
      id: Date.now(),
      title: `d${req.sides}`,
      lines: [{ label: "", value: String(v), big: true }],
      summary: String(v),
    };
  }
  if (req.kind === "formula") {
    const r = rollFormula(req.formula);
    if (!r) return { id: Date.now(), title: "Invalid formula", lines: [{ label: "", value: req.formula }], summary: "invalid" };
    return {
      id: Date.now(),
      title: req.label || r.formula,
      lines: [
        { label: r.formula, value: r.breakdown },
        { label: "", value: String(r.total), big: true },
      ],
      summary: `${r.breakdown} = ${r.total}`,
    };
  }
  // attack
  const d20 = rollDie(20);
  const attackTotal = d20 + req.attackBonus;
  const crit = d20 === 20 ? "hit" : d20 === 1 ? "miss" : undefined;
  const dmg = rollFormula(req.damageFormula);
  let dmgLine = "—";
  let dmgTotal = 0;
  if (dmg) {
    if (crit === "hit") {
      const extra = rollFormula(req.damageFormula);
      const extraDice = extra ? extra.rolls.reduce((a, r) => a + r.value, 0) : 0;
      dmgTotal = dmg.total + extraDice;
      dmgLine = `${dmg.breakdown} + ${extraDice} (crit) = ${dmgTotal}`;
    } else {
      dmgTotal = dmg.total;
      dmgLine = `${dmg.breakdown} = ${dmgTotal}`;
    }
  }
  return {
    id: Date.now(),
    title: req.label,
    lines: [
      { label: "attack", value: `[${d20}]${fmt(req.attackBonus)} = ${attackTotal}`, crit },
      ...(crit === "hit" ? [{ label: "", value: "CRITICAL HIT! 💥", crit: "hit" as const }] : []),
      ...(crit === "miss" ? [{ label: "", value: "Critical Miss! 💀", crit: "miss" as const }] : []),

      ...(dmg ? [{ label: "damage", value: dmgLine, big: true }] : []),
    ],
    summary: `atk [${d20}]${fmt(req.attackBonus)}=${attackTotal}${dmg ? ` · dmg ${dmgTotal}` : ""}${crit === "hit" ? " CRIT" : ""}`,
  };
}

