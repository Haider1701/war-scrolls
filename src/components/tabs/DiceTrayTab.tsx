import { useState } from "react";
import { useDiceRoller } from "@/components/DiceRoller";

type LogEntry = { id: number; label: string; result: string; at: string };
const DICE = [4, 6, 8, 10, 12, 20, 100];

export function DiceTrayTab() {
  const openRoll = useDiceRoller();
  const [formula, setFormula] = useState("2d6+3");
  const [modifier, setModifier] = useState("0");
  const [advMode, setAdvMode] = useState<"normal" | "adv" | "dis">("normal");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [last, setLast] = useState<null | (() => void)>(null);

  function push(label: string, result: string) {
    setLog((l) => [{ id: Date.now(), label, result, at: new Date().toLocaleTimeString() }, ...l].slice(0, 12));
  }

  function currentMod(): number {
    const n = parseInt(modifier, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function withMod(base: string): string {
    const m = currentMod();
    if (m === 0) return base;
    return m > 0 ? `${base}+${m}` : `${base}${m}`;
  }

  function rollSingle(sides: number) {
    const action = () => {
      const label = sides === 20 && advMode !== "normal" ? `d20 ${advMode}` : `d${sides}`;
      let displayed;
      if (sides === 20 && advMode !== "normal") {
        displayed = openRoll({ kind: "die", label, sides: 20, mode: advMode });
      } else if (currentMod() !== 0) {
        const f = withMod(`1d${sides}`);
        displayed = openRoll({ kind: "formula", label: f, formula: f });
      } else {
        displayed = openRoll({ kind: "die", label, sides });
      }
      push(label + (currentMod() !== 0 && !(sides === 20 && advMode !== "normal") ? ` ${currentMod() > 0 ? "+" : ""}${currentMod()}` : ""), displayed.summary);
    };
    setLast(() => action);
    action();
  }

  function rollCustom() {
    const action = () => {
      const f = withMod(formula.trim());
      const displayed = openRoll({ kind: "formula", label: f, formula: f });
      push(f, displayed.summary);
    };
    setLast(() => action);
    action();
  }

  return (
    <div className="j-fade space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="j-h text-2xl">⚄ Dice Tray</h2>
        <div className="flex items-center gap-1 text-xs flex-wrap">
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

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-center">
          <input
            className="j-input"
            placeholder="e.g. 2d6+1d4+3"
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") rollCustom(); }}
          />
          <label className="flex items-center gap-2 text-xs">
            <span className="text-[var(--color-muted)] uppercase tracking-widest">Mod</span>
            <input
              className="j-input w-20 text-center"
              value={modifier}
              onChange={(e) => setModifier(e.target.value.replace(/[^\d-]/g, ""))}
              placeholder="0"
            />
          </label>
          <button className="j-btn" onClick={rollCustom}>Roll Formula</button>
        </div>

        <div className="mt-3 flex gap-2 flex-wrap">
          <button className="j-btn j-btn-ghost" disabled={!last} onClick={() => last && last()}>
            🔁 Repeat Last
          </button>
          <button className="j-btn j-btn-ghost" onClick={() => setLog([])} disabled={log.length === 0}>
            Clear History
          </button>
        </div>
        <p className="text-[10px] italic text-[var(--color-muted)] mt-2">
          Mix dice freely: <code>2d6+1d4+3</code>. Adv/Dis applies to any d20 roll (including checks).
        </p>
      </div>

      <div>
        <div className="j-h text-lg mb-2">Roll History</div>
        {log.length === 0 ? (
          <div className="j-card text-[var(--color-muted)] italic text-center py-6">No rolls yet.</div>
        ) : (
          <div className="j-card divide-y divide-[rgba(255,106,0,0.15)]">
            {log.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="text-[var(--color-muted)] tabular-nums text-xs w-20 shrink-0">{e.at}</span>
                <span className="text-[var(--color-flame)] w-32 truncate shrink-0">{e.label}</span>
                <span className="j-glow-text flex-1 truncate">→ {e.result}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
