import { useState } from "react";
import { rollDie, rollFormula, rollD20, type RollResult } from "@/lib/dice";
import { useDiceRoller } from "@/components/DiceRoller";

type LogEntry = { id: number; label: string; result: string; at: string };
const DICE = [4, 6, 8, 10, 12, 20, 100];

export function DiceTrayTab() {
  const openRoll = useDiceRoller();
  const [formula, setFormula] = useState("2d6+3");
  const [advMode, setAdvMode] = useState<"normal" | "adv" | "dis">("normal");
  const [log, setLog] = useState<LogEntry[]>([]);

  function push(label: string, result: string) {
    setLog((l) => [{ id: Date.now(), label, result, at: new Date().toLocaleTimeString() }, ...l].slice(0, 10));
  }

  function rollSingle(sides: number) {
    if (sides === 20 && advMode !== "normal") {
      openRoll({ kind: "die", label: `d20 ${advMode}`, sides: 20, mode: advMode });
      const r = rollD20(advMode);
      push(`d20 (${advMode})`, `[${r.a}·${r.b}] → ${r.picked}`);
      return;
    }
    openRoll({ kind: "die", label: `d${sides}`, sides });
    const v = rollDie(sides);
    push(`d${sides}`, String(v));
  }

  function rollCustom() {
    const r: RollResult | null = rollFormula(formula);
    if (!r) { push(formula, "invalid formula"); return; }
    openRoll({ kind: "formula", label: formula, formula });
    push(formula, `${r.breakdown} = ${r.total}`);
  }

  return (
    <div className="j-fade space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="j-h text-2xl">⚄ Dice Tray</h2>
        <div className="flex items-center gap-1 text-xs">
          {(["normal", "adv", "dis"] as const).map((m) => (
            <button key={m} onClick={() => setAdvMode(m)}
              className={`j-btn ${advMode === m ? "" : "j-btn-ghost"}`}>
              {m === "normal" ? "Normal" : m === "adv" ? "Advantage" : "Disadvantage"}
            </button>
          ))}
        </div>
      </div>

      <div className="dice-tray p-6 md:p-8 rounded-lg">
        <div className="grid grid-cols-4 md:grid-cols-7 gap-3 md:gap-4">
          {DICE.map((s) => (
            <button key={s} onClick={() => rollSingle(s)} className="dice-btn group">
              <span className="dice-face">d{s}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <input
            className="j-input flex-1"
            placeholder="e.g. 2d6+3, 4d8, 1d20-1"
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") rollCustom(); }}
          />
          <button className="j-btn" onClick={rollCustom}>Roll Formula</button>
        </div>
      </div>

      <div>
        <div className="j-h text-lg mb-2">Roll History</div>
        {log.length === 0 ? (
          <div className="j-card text-[var(--color-muted)] italic text-center py-6">No rolls yet.</div>
        ) : (
          <div className="j-card divide-y divide-[rgba(255,106,0,0.15)]">
            {log.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="text-[var(--color-muted)] tabular-nums text-xs w-20">{e.at}</span>
                <span className="text-[var(--color-flame)] w-24 truncate">{e.label}</span>
                <span className="j-glow-text flex-1 truncate">→ {e.result}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
