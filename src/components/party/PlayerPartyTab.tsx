import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PartyDashboard } from "./PartyDashboard";

export function PlayerPartyTab({ userId, characterId }: { userId: string; characterId: string }) {
  const [campaignId, setCampaignId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    (supabase as any).from("campaign_members").select("campaign_id").eq("player_user_id", userId).eq("character_id", characterId).limit(1)
      .then(({ data }: any) => setCampaignId(data?.[0]?.campaign_id ?? null));
  }, [userId, characterId]);
  if (campaignId === undefined) return <div className="py-12 text-center italic text-[var(--color-muted)]">Gathering the party…</div>;
  if (!campaignId) return <div className="py-12 text-center italic text-[var(--color-muted)]">Join a campaign to see your party.</div>;
  return <PartyDashboard campaignId={campaignId} userId={userId} isDm={false} />;
}
