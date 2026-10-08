import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hpTier } from "@/lib/party";

const db = supabase as any;

export type PartyRow = {
  membership_id: string; campaign_id: string; character_id: string; player_user_id: string;
  name: string; class_level: string; image_url: string | null;
  hp_current: number; hp_max: number; temp_hp: number; armor_class: number; speed: number;
  passive_perception: number; passive_investigation: number; passive_insight: number;
  hit_dice: string; con_mod: number; status_conditions: string[]; concentration_spell: string | null;
  death_save_successes: number; death_save_failures: number;
};

export const CONDITIONS: Record<string, string> = {
  Blinded: "Can't see; auto-fails sight checks. Attacks against it have advantage; its attacks have disadvantage.",
  Charmed: "Can't attack the charmer or target them with harmful effects. Charmer has advantage on social checks.",
  Deafened: "Can't hear; auto-fails hearing checks.",
  Exhaustion: "Cumulative levels: disadvantage on checks, halved speed, disadvantage on attacks/saves, halved HP max, speed 0, death.",
  Frightened: "Disadvantage on checks and attacks while the source is in sight; can't willingly move closer.",
  Grappled: "Speed becomes 0 and can't benefit from bonuses to speed.",
  Incapacitated: "Can't take actions or reactions.",
  Invisible: "Can't be seen without magic. Its attacks have advantage; attacks against it have disadvantage.",
  Paralyzed: "Incapacitated, can't move or speak. Auto-fails STR/DEX saves. Hits within 5 ft are critical.",
  Petrified: "Turned to stone; incapacitated, resistant to all damage, immune to poison and disease.",
  Poisoned: "Disadvantage on attack rolls and ability checks.",
  Prone: "Can only crawl. Disadvantage on attacks. Melee attacks against it have advantage, ranged disadvantage.",
  Restrained: "Speed 0. Attacks against it have advantage; its attacks and DEX saves have disadvantage.",
  Stunned: "Incapacitated, can't move, speaks falteringly. Auto-fails STR/DEX saves; attacks against it have advantage.",
  Unconscious: "Incapacitated, drops items, falls prone. Auto-fails STR/DEX saves. Hits within 5 ft are critical.",
};

const TIER_COLOR = { healthy: "#4caf6e", wounded: "#e0c040", bloodied: "#ff8a1e", critical: "#c43030", down: "#111" } as const;

type Props = {
  campaignId: string; userId: string; isDm: boolean;
  onGrantLevelUp?: (characterId: string) => void;
  onViewSheet?: (characterId: string) => void;
};

export function PartyDashboard({ campaignId, userId, isDm, onGrantLevelUp, onViewSheet }: Props) {
  const [rows, setRows] = useState<PartyRow[]>([]);
  const [showHp, setShowHp] = useState(false);
  const [live, setLive] = useState<"live" | "reconnecting">("reconnecting");
  const [passives, setPassives] = useState(false);
  const [shortRest, setShortRest] = useState(false);
  const [confirmLong, setConfirmLong] = useState(false);

  const load = useCallback(async () => {
    const [{ data }, { data: camp }] = await Promise.all([
      db.from("party_status").select("*").eq("campaign_id", campaignId).order("name"),
      db.from("campaigns").select("show_party_hp").eq("id", campaignId).maybeSingle(),
    ]);
    setRows((data ?? []) as PartyRow[]);
    setShowHp(!!camp?.show_party_hp);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel(`party-${campaignId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_status", filter: `campaign_id=eq.${campaignId}` }, (p: any) => {
        if (p.eventType === "DELETE") setRows((r) => r.filter((x) => x.membership_id !== p.old.membership_id));
        else setRows((r) => {
          const n = p.new as PartyRow; const i = r.findIndex((x) => x.membership_id === n.membership_id);
          return i < 0 ? [...r, n] : r.map((x, j) => (j === i ? n : x));
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "campaigns", filter: `id=eq.${campaignId}` }, (p: any) => setShowHp(!!p.new.show_party_hp))
      .subscribe((s) => { setLive(s === "SUBSCRIBED" ? "live" : "reconnecting"); if (s === "SUBSCRIBED") load(); });
    return () => { supabase.removeChannel(ch); };
  }, [campaignId, load]);

  async function patch(row: PartyRow, p: Partial<PartyRow>) {
    setRows((r) => r.map((x) => (x.membership_id === row.membership_id ? { ...x, ...p } : x)));
    await db.from("party_status").update(p).eq("membership_id", row.membership_id);
  }
  async function toggleShowHp() {
    const v = !showHp; setShowHp(v);
    await db.from("campaigns").update({ show_party_hp: v }).eq("id", campaignId);
  }
  async function longRest() {
    setConfirmLong(false);
    await db.rpc("dm_long_rest", { _campaign_id: campaignId });
    load();
  }

  return (
    <section className="space-y-4 j-fade">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="j-h text-lg">👥 Party</h3>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${live === "live" ? "border-[#4caf6e] text-[#7fd69a]" : "border-[var(--color-blood)] text-[var(--color-blood)]"}`}>
          {live === "live" ? "🟢 Live" : "🔴 Reconnecting…"}
        </span>
        <div className="flex-1" />
        {isDm && <>
          <button className="j-btn !py-1 text-xs" onClick={() => setConfirmLong(true)}>💊 Long Rest — All Party</button>
          <button className="j-btn j-btn-ghost !py-1 text-xs" onClick={() => setShortRest(true)}>🌙 Short Rest</button>
          <button className="j-btn j-btn-ghost !py-1 text-xs" onClick={() => setPassives(true)}>🎲 Passive Checks</button>
          <label className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
            <input type="checkbox" checked={showHp} onChange={toggleShowHp} /> Show HP numbers to players
          </label>
        </>}
      </div>

      {rows.length === 0 ? (
        <div className="j-card italic text-center text-[var(--color-muted)] py-8">No adventurers have joined with a character yet.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <PartyCard key={r.membership_id} row={r} isDm={isDm}
              exact={isDm || showHp || r.player_user_id === userId}
              onPatch={(p) => patch(r, p)}
              onGrantLevelUp={onGrantLevelUp && (() => onGrantLevelUp(r.character_id))}
              onViewSheet={onViewSheet && (() => onViewSheet(r.character_id))} />
          ))}
        </div>
      )}

      {confirmLong && (
        <Modal onClose={() => setConfirmLong(false)} title="💊 Long Rest">
          <p className="text-sm">Restore every party member to full HP, clear all conditions, concentration and death saves, and reset spell slots?</p>
          <div className="flex gap-2 justify-end mt-4">
            <button className="j-btn j-btn-ghost" onClick={() => setConfirmLong(false)}>Cancel</button>
            <button className="j-btn" onClick={longRest}>Take Long Rest</button>
          </div>
        </Modal>
      )}
      {shortRest && <ShortRestModal rows={rows} onClose={() => setShortRest(false)} onApply={patch} />}
      {passives && (
        <Modal onClose={() => setPassives(false)} title="🎲 Passive Checks">
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] uppercase text-[var(--color-muted)] text-left"><th className="py-1">Name</th><th>Perception</th><th>Investigation</th><th>Insight</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.membership_id} className="border-t border-[rgba(255,106,0,.15)]">
                <td className="py-1.5">{r.name}</td><td>{r.passive_perception}</td><td>{r.passive_investigation}</td><td>{r.passive_insight}</td>
              </tr>
            ))}</tbody>
          </table>
        </Modal>
      )}
    </section>
  );
}

function PartyCard({ row: r, isDm, exact, onPatch, onGrantLevelUp, onViewSheet }: {
  row: PartyRow; isDm: boolean; exact: boolean; onPatch: (p: Partial<PartyRow>) => void;
  onGrantLevelUp?: () => void; onViewSheet?: () => void;
}) {
  const [amt, setAmt] = useState(5);
  const [conc, setConc] = useState(r.concentration_spell ?? "");
  const [tip, setTip] = useState<string | null>(null);
  useEffect(() => setConc(r.concentration_spell ?? ""), [r.concentration_spell]);
  const tier = hpTier(r.hp_current, r.hp_max);
  const pct = r.hp_max > 0 ? Math.max(0, Math.min(100, (r.hp_current / r.hp_max) * 100)) : 0;
  const down = tier === "down";
  const stable = r.death_save_successes >= 3;
  const dead = r.death_save_failures >= 3;

  function damage(n: number) {
    let temp = r.temp_hp, hp = r.hp_current;
    const fromTemp = Math.min(temp, n); temp -= fromTemp; hp = Math.max(0, hp - (n - fromTemp));
    onPatch({ temp_hp: temp, hp_current: hp });
  }
  function heal(n: number) {
    const hp = Math.min(r.hp_max, r.hp_current + n);
    onPatch(hp > 0 && r.hp_current === 0 ? { hp_current: hp, death_save_successes: 0, death_save_failures: 0 } : { hp_current: hp });
  }

  return (
    <div className={`j-card space-y-2 ${down && !stable && !dead ? "party-down" : ""}`}>
      <div className="flex items-center gap-3">
        {r.image_url ? <img src={r.image_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-[var(--color-ember)]" />
          : <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl border-2 border-[var(--color-ember)]">🛡️</div>}
        <div className="min-w-0 flex-1">
          <div className="j-h text-lg truncate">{down && "⚠️ "}{r.name}</div>
          <div className="text-xs text-[var(--color-muted)] truncate">{r.class_level}</div>
        </div>
      </div>

      <div>
        <div className="h-3 rounded-full overflow-hidden bg-[rgba(0,0,0,.5)] border border-[rgba(255,106,0,.25)]">
          <div className="h-full transition-all duration-300" style={{ width: `${down ? 100 : pct}%`, background: TIER_COLOR[tier] }} />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span>{down ? "💀 0 HP" : exact ? `${r.hp_current} / ${r.hp_max}` : ""}</span>
          {exact && r.temp_hp > 0 && <span className="text-[#5fd3e0]">+{r.temp_hp} temp</span>}
        </div>
      </div>

      <div className="text-xs flex flex-wrap gap-x-3 text-[var(--color-muted)]">
        <span>🛡️ AC {r.armor_class}</span><span>⚡ {r.speed}ft</span><span>👁️ PP {r.passive_perception}</span>
      </div>

      {r.concentration_spell && <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-[rgba(160,102,216,.2)] border border-[#a066d8]">💜 {r.concentration_spell}</span>}

      {r.status_conditions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {r.status_conditions.map((c) => (
            <button key={c} className="j-cond-pill" onClick={() => setTip(tip === c ? null : c)} title={CONDITIONS[c]}>
              {c}{isDm && <span className="ml-1 opacity-70" onClick={(e) => { e.stopPropagation(); onPatch({ status_conditions: r.status_conditions.filter((x) => x !== c) }); }}>✕</span>}
            </button>
          ))}
        </div>
      )}
      {tip && <div className="text-xs p-2 rounded bg-[rgba(0,0,0,.4)]"><b>{tip}:</b> {CONDITIONS[tip] ?? ""}</div>}

      {down && (
        <div className="text-xs space-y-1 p-2 rounded bg-[rgba(196,48,48,.12)]">
          {(["death_save_successes", "death_save_failures"] as const).map((k) => (
            <div key={k} className="flex items-center gap-1">
              <span className="w-16">{k === "death_save_successes" ? "Successes" : "Failures"}</span>
              {[1, 2, 3].map((i) => (
                <button key={i} disabled={!isDm} onClick={() => onPatch({ [k]: r[k] >= i ? i - 1 : i } as any)}
                  className="w-6 h-6 rounded-full border border-[var(--color-ember)] text-xs">
                  {r[k] >= i ? (k === "death_save_successes" ? "✓" : "✗") : "○"}
                </button>
              ))}
            </div>
          ))}
          {stable && <div className="text-[#7fd69a]">Stabilized</div>}
          {dead && <div className="text-[var(--color-blood)]">💀 Dead</div>}
        </div>
      )}

      {isDm && (
        <div className="space-y-2 pt-2 border-t border-[rgba(255,106,0,.15)]">
          <div className="flex gap-1 items-center">
            <input type="number" min={0} className="j-input !py-1 w-16 text-sm" value={amt} onChange={(e) => setAmt(Math.max(0, +e.target.value || 0))} />
            <button className="j-btn !py-1 !px-2 text-xs" onClick={() => damage(amt)}>− Damage</button>
            <button className="j-btn j-btn-ghost !py-1 !px-2 text-xs" onClick={() => heal(amt)}>+ Heal</button>
            <button className="j-btn j-btn-ghost !py-1 !px-2 text-xs" onClick={() => onPatch({ temp_hp: amt })} title="Set temp HP">Temp</button>
          </div>
          <div className="flex gap-1">
            <select className="j-input !py-1 text-xs flex-1" value="" onChange={(e) => e.target.value && !r.status_conditions.includes(e.target.value) && onPatch({ status_conditions: [...r.status_conditions, e.target.value] })}>
              <option value="">+ Condition</option>
              {Object.keys(CONDITIONS).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="j-input !py-1 text-xs flex-1" placeholder="Concentration" value={conc} onChange={(e) => setConc(e.target.value)}
              onBlur={() => conc !== (r.concentration_spell ?? "") && onPatch({ concentration_spell: conc.trim() || null })} />
          </div>
          <div className="flex gap-1">
            {onGrantLevelUp && <button className="j-btn j-btn-ghost !py-1 text-xs flex-1" onClick={onGrantLevelUp}>⬆️ Grant Level Up</button>}
            {onViewSheet && <button className="j-btn j-btn-ghost !py-1 text-xs flex-1" onClick={onViewSheet}>👁️ View Sheet</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function ShortRestModal({ rows, onClose, onApply }: { rows: PartyRow[]; onClose: () => void; onApply: (r: PartyRow, p: Partial<PartyRow>) => Promise<void> }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [results, setResults] = useState<Record<string, string>>({});
  const die = (hd: string) => { const m = hd.match(/d(\d+)/i); return m ? +m[1] : 8; };
  async function roll(r: PartyRow) {
    const n = counts[r.membership_id] ?? 1; const d = die(r.hit_dice);
    const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * d));
    const gain = Math.max(0, rolls.reduce((a, b) => a + b, 0) + r.con_mod * n);
    await onApply(r, { hp_current: Math.min(r.hp_max, r.hp_current + gain) });
    setResults((x) => ({ ...x, [r.membership_id]: `[${rolls.join(", ")}] ${r.con_mod >= 0 ? "+" : ""}${r.con_mod * n} = +${gain} HP` }));
  }
  return (
    <Modal onClose={onClose} title="🌙 Short Rest">
      <div className="space-y-3">
        {rows.map((r) => {
          const n = counts[r.membership_id] ?? 1;
          return (
            <div key={r.membership_id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex-1 min-w-[8rem]"><b>{r.name}</b> · d{die(r.hit_dice)} · {r.hp_current}/{r.hp_max}</span>
              <button className="j-btn j-btn-ghost !py-0.5 !px-2" onClick={() => setCounts({ ...counts, [r.membership_id]: Math.max(1, n - 1) })}>−</button>
              <span className="w-5 text-center">{n}</span>
              <button className="j-btn j-btn-ghost !py-0.5 !px-2" onClick={() => setCounts({ ...counts, [r.membership_id]: Math.min(20, n + 1) })}>+</button>
              <button className="j-btn !py-0.5 !px-2 text-xs" onClick={() => roll(r)}>Roll</button>
              {results[r.membership_id] && <span className="w-full text-xs text-[var(--color-muted)]">{results[r.membership_id]}</span>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="j-page w-full max-w-lg rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3"><h3 className="j-h text-xl">{title}</h3><button onClick={onClose} aria-label="Close">✕</button></div>
        {children}
      </div>
    </div>
  );
}
