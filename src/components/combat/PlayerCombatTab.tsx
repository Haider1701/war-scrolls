import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Combatant, CombatSession } from "@/lib/combatTypes";

const db = supabase as any;

export function PlayerCombatTab({ userId, characterId }: { userId: string; characterId: string }) {
  const [session, setSession] = useState<CombatSession | null>(null);
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: memberships } = await db.from("campaign_members").select("campaign_id").eq("player_user_id", userId).eq("character_id", characterId);
    const ids = (memberships ?? []).map((m: any) => m.campaign_id);
    if (!ids.length) { setSession(null); setCombatants([]); return; }
    const { data: sessions } = await db.from("combat_sessions").select("*").in("campaign_id", ids).eq("is_active", true).order("created_at", { ascending: false }).limit(1);
    const active = (sessions?.[0] as CombatSession) ?? null;
    setSession(active); setCampaignId(active?.campaign_id ?? null);
    if (!active) { setCombatants([]); return; }
    const { data } = await db.from("combat_combatants").select("*").eq("combat_session_id", active.id).order("turn_order");
    setCombatants((data ?? []) as Combatant[]);
  }, [userId, characterId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!campaignId) return;
    const ch = supabase.channel(`combat-player-${campaignId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "combat_sessions", filter: `campaign_id=eq.${campaignId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "combat_combatants", filter: `campaign_id=eq.${campaignId}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [campaignId, load]);

  if (!session) return <div className="py-12 text-center italic text-[var(--color-muted)]">No active combat.</div>;
  const current = combatants[Math.min(session.current_turn_index, Math.max(0, combatants.length - 1))];
  const myTurn = current?.player_user_id === userId || current?.character_id === characterId;
  return <div className="space-y-3 j-fade">
    <div className="flex items-end"><div><div className="text-[10px] uppercase text-[var(--color-muted)]">Active combat</div><h2 className="j-h text-xl">{session.name}</h2></div><div className="flex-1"/><span className="j-card !py-1 !px-3">Round {session.round_number}</span></div>
    {current && <div className={`rounded-lg px-4 py-2 text-center ${myTurn ? "j-turn-banner" : "j-card"}`}>{myTurn ? "⚔️ Your turn" : <><b>{current.name}</b> is acting</>}</div>}
    <div className="space-y-2">{combatants.map((c, index) => <div key={c.id} className={`j-combat-row ${current?.id === c.id ? "is-current" : ""} ${c.is_defeated ? "is-defeated" : ""}`}><span className="w-8 text-center j-glow-text text-lg">{c.initiative_roll || "—"}</span><span className="flex-1 min-w-0"><span className="j-combat-name block truncate">{index + 1}. {c.name}</span><span className="text-[10px] text-[var(--color-muted)]">AC {c.ac} · HP {c.hp_current}/{c.hp_max}</span>{c.status_conditions.length > 0 && <span className="flex flex-wrap gap-1 mt-1">{c.status_conditions.map((x) => <span className="j-cond-pill" key={x}>{x}</span>)}</span>}</span>{current?.id === c.id && <span className="text-lg">🔥</span>}</div>)}</div>
  </div>;
}