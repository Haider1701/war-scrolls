import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { rollDie, rollFormula, rollWithMode, type RollMode } from "@/lib/dice";

export type RollRequest =
  | { kind: "skill"; label: string; modifier: number }
  | { kind: "save"; label: string; modifier: number }
  | { kind: "attack"; label: string; attackBonus: number; damageFormula: string }
  | { kind: "die"; label: string; sides: number; modifier?: number }
  | { kind: "formula"; label: string; formula: string };

export type Displayed = {
  id: number;
  title: string;
  lines: {
    label: string;
    value: string;
    big?: boolean;
    crit?: "hit" | "miss";
    pair?: { picked: number; dropped: number; mode: "adv" | "dis" };
  }[];
  summary: string; // one-line summary for logs
};

type Api = { roll: (req: RollRequest) => Displayed; mode: RollMode; setMode: (m: RollMode) => void };
const Ctx = createContext<Api>({
  roll: () => ({ id: 0, title: "", lines: [], summary: "" }),
  mode: "normal",
  setMode: () => {},
});
export const useDiceRoller = () => useContext(Ctx).roll;
export const useRollMode = () => {
  const { mode, setMode } = useContext(Ctx);
  return { mode, setMode };
};

export function DiceRollerProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Displayed | null>(null);
  const [spin, setSpin] = useState<number | null>(null);
  const [mode, setMode] = useState<RollMode>("normal");
  const modeRef = useRef<RollMode>("normal");
  modeRef.current = mode;
  const timerRef = useRef<number | null>(null);
  const closeRef = useRef<number | null>(null);

  const clear = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (closeRef.current) window.clearTimeout(closeRef.current);
    timerRef.current = null; closeRef.current = null;
  };

  const roll = useCallback((req: RollRequest): Displayed => {
    clear();
    // Compute the ACTUAL result ONCE — single source of truth for popup + history
    const displayed = compute(req, modeRef.current);

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
                {l.pair ? (
                  <span className="inline-flex items-center gap-3 tabular-nums">
                    <span className={l.pair.mode === "adv" ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]" : "text-[var(--color-blood)] drop-shadow-[0_0_10px_rgba(190,40,40,0.6)]"}>
                      {l.pair.mode === "adv" ? "▲" : "▼"}{l.pair.picked}
                    </span>
                    <span className="line-through opacity-40 text-[var(--color-muted)] text-[0.7em]">{l.pair.dropped}</span>
                  </span>
                ) : (
                  <span className={l.crit === "hit" ? "j-glow-text drop-shadow-[0_0_10px_var(--color-flame)]" : l.crit === "miss" ? "text-[var(--color-blood)]" : "j-glow-text"}>
                    {l.value}
                  </span>
                )}
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

  const api = useMemo<Api>(() => ({ roll, mode, setMode }), [roll, mode]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {dot}
    </Ctx.Provider>
  );
}

function fmt(n: number) { return n >= 0 ? `+${n}` : `${n}`; }
export function modeTitle(mode: RollMode) {
  return mode === "adv" ? "Rolling with Advantage" : mode === "dis" ? "Rolling with Disadvantage" : "";
}
export function modeTag(mode: RollMode) {
  return mode === "adv" ? "[ADV] " : mode === "dis" ? "[DIS] " : "";
}

function compute(req: RollRequest, mode: RollMode): Displayed {
  const id = Date.now();
  const suffix = mode === "normal" ? "" : ` — ${modeTitle(mode)}`;

  if (req.kind === "skill" || req.kind === "save") {
    const r = rollWithMode(20, req.modifier, mode);
    const pair = mode === "normal" ? undefined : { picked: r.picked, dropped: r.a === r.picked ? (r.b as number) : r.a, mode: mode as "adv" | "dis" };
    return {
      id,
      title: `${req.label} ${req.kind === "save" ? "Save" : "Check"}${suffix}`,
      lines: [
        ...(pair ? [{ label: "d20", value: "", pair }] : [{ label: "d20", value: `[${r.picked}] ${fmt(req.modifier)} = ${r.total}` }]),
        { label: "", value: String(r.total), big: true },
      ],
      summary: `${modeTag(mode)}${r.display}${fmt(req.modifier)} = ${r.total}`,
    };
  }

  if (req.kind === "die") {
    const modifier = req.modifier ?? 0;
    const r = rollWithMode(req.sides, modifier, mode);
    const pair = mode === "normal" ? undefined : { picked: r.picked, dropped: r.a === r.picked ? (r.b as number) : r.a, mode: mode as "adv" | "dis" };
    return {
      id,
      title: mode === "normal" ? `d${req.sides}` : `${modeTitle(mode)} — d${req.sides}`,
      lines: [
        ...(pair ? [{ label: `d${req.sides}`, value: "", pair }] : []),
        { label: "", value: String(r.total), big: true },
        ...(modifier !== 0 ? [{ label: "with mod", value: `${r.picked} ${fmt(modifier)} = ${r.total}` }] : []),
      ],
      summary: `${modeTag(mode)}d${req.sides} → ${mode === "normal" ? `[${r.picked}]` : `[${r.picked}, ${pair!.dropped}]`}${modifier !== 0 ? ` ${fmt(modifier)}` : ""} = ${r.total}`,
    };
  }

  if (req.kind === "formula") {
    const r = rollFormula(req.formula, mode);
    if (!r) return { id, title: "Invalid formula", lines: [{ label: "", value: req.formula }], summary: "invalid" };
    return {
      id,
      title: `${req.label || r.formula}${suffix}`,
      lines: [
        { label: r.formula, value: r.breakdown },
        { label: "", value: String(r.total), big: true },
      ],
      summary: `${r.breakdown} = ${r.total}`,
    };
  }

  // attack
  const atk = rollWithMode(20, req.attackBonus, mode);
  const crit = atk.picked === 20 ? "hit" : atk.picked === 1 ? "miss" : undefined;
  const pair = mode === "normal" ? undefined : { picked: atk.picked, dropped: atk.a === atk.picked ? (atk.b as number) : atk.a, mode: mode as "adv" | "dis" };
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
    id,
    title: `${req.label}${suffix}`,
    lines: [
      ...(pair ? [{ label: "attack", value: "", pair }] : []),
      { label: pair ? "total" : "attack", value: `[${atk.picked}]${fmt(req.attackBonus)} = ${atk.total}`, crit },
      ...(crit === "hit" ? [{ label: "", value: "CRITICAL HIT! 💥", crit: "hit" as const }] : []),
      ...(crit === "miss" ? [{ label: "", value: "Critical Miss! 💀", crit: "miss" as const }] : []),
      ...(dmg ? [{ label: "damage", value: dmgLine, big: true }] : []),
    ],
    summary: `${modeTag(mode)}atk ${atk.display}${fmt(req.attackBonus)}=${atk.total}${dmg ? ` · dmg ${dmgTotal}` : ""}${crit === "hit" ? " CRIT" : ""}`,
  };
}
