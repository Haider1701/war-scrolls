import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

type Entry = { name: string; dm: string };

export function CampaignBadge({ userId, characterId }: { userId: string; characterId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: mems } = await db
        .from("campaign_members")
        .select("campaign_id")
        .eq("player_user_id", userId)
        .eq("character_id", characterId);
      const ids = (mems ?? []).map((m: any) => m.campaign_id);
      if (ids.length === 0) { if (alive) setEntries([]); return; }
      const { data: camps } = await db.from("campaigns").select("id,name,dm_user_id").in("id", ids);
      const dmIds = Array.from(new Set((camps ?? []).map((c: any) => c.dm_user_id)));
      const { data: profs } = await db.from("user_profiles").select("user_id,display_name").in("user_id", dmIds);
      const pmap = new Map<string, string>((profs ?? []).map((p: any) => [p.user_id, p.display_name]));
      if (!alive) return;
      setEntries((camps ?? []).map((c: any) => ({ name: c.name, dm: pmap.get(c.dm_user_id) ?? "Unknown DM" })));
    })();
    return () => { alive = false; };
  }, [userId, characterId]);

  if (entries.length === 0) return null;
  return (
    <div className="w-full basis-full flex flex-wrap gap-2 pt-1 text-[11px] text-[var(--color-muted)]">
      {entries.map((e, i) => (
        <span key={i} className="px-2 py-0.5 rounded-full border border-[rgba(255,106,0,0.25)] bg-[rgba(255,106,0,0.06)]">
          📖 Campaign: <span className="j-glow-text">{e.name}</span> · DM: {e.dm}
        </span>
      ))}
    </div>
  );
}
