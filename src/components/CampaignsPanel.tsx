import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Campaign, CampaignMember, Character, MembershipView } from "@/lib/types";

const db = supabase as any;

function makeJoinCode() {
  // 6 chars, avoid ambiguous 0/O/1/I
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function CampaignsPanel({
  userId,
  characters,
  activeCharacterId,
}: {
  userId: string;
  characters: Character[];
  activeCharacterId: string;
}) {
  const [dmCampaigns, setDmCampaigns] = useState<Campaign[]>([]);
  const [memberships, setMemberships] = useState<MembershipView[]>([]);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinPreview, setJoinPreview] = useState<{ campaign: Campaign; dmName: string } | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const playerCharacters = characters.filter((c) => c.character_type === "player");

  const refresh = useCallback(async () => {
    // DM's own campaigns
    const { data: mine } = await db.from("campaigns").select("*").eq("dm_user_id", userId).order("created_at", { ascending: false });
    setDmCampaigns((mine ?? []) as Campaign[]);

    // Memberships as player (joined with campaign + dm profile)
    const { data: mems } = await db.from("campaign_members").select("*").eq("player_user_id", userId);
    const list = (mems ?? []) as CampaignMember[];
    if (list.length === 0) { setMemberships([]); return; }
    const campaignIds = list.map((m) => m.campaign_id);
    const { data: camps } = await db.from("campaigns").select("*").in("id", campaignIds);
    const campMap = new Map<string, Campaign>((camps ?? []).map((c: Campaign) => [c.id, c]));
    const dmIds = Array.from(new Set((camps ?? []).map((c: Campaign) => c.dm_user_id)));
    const { data: profiles } = await db.from("user_profiles").select("user_id,display_name").in("user_id", dmIds);
    const profileMap = new Map<string, string>((profiles ?? []).map((p: any) => [p.user_id, p.display_name]));
    setMemberships(list.flatMap((m) => {
      const c = campMap.get(m.campaign_id);
      if (!c) return [];
      return [{ membership: m, campaign: c, dm_display_name: profileMap.get(c.dm_user_id) ?? "Unknown DM" }];
    }));
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function createCampaign() {
    if (!newName.trim()) return;
    setCreating(true);
    let attempts = 0;
    while (attempts < 5) {
      const code = makeJoinCode();
      const { error } = await db.from("campaigns").insert({
        dm_user_id: userId,
        name: newName.trim(),
        description: newDesc.trim() || null,
        join_code: code,
      });
      if (!error) break;
      if (!String(error.message ?? "").includes("join_code")) break; // not a code collision
      attempts++;
    }
    setCreating(false);
    setNewName(""); setNewDesc("");
    await refresh();
  }

  async function deleteCampaign(id: string) {
    if (!confirm("Delete this campaign? All player memberships will be removed.")) return;
    await db.from("campaigns").delete().eq("id", id);
    await refresh();
  }

  async function regenCode(id: string) {
    for (let i = 0; i < 5; i++) {
      const { error } = await db.from("campaigns").update({ join_code: makeJoinCode() }).eq("id", id);
      if (!error) break;
    }
    await refresh();
  }

  async function lookupCode() {
    setJoinError(null); setJoinPreview(null);
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    const { data: camp } = await db.from("campaigns").select("*").eq("join_code", code).maybeSingle();
    if (!camp) { setJoinError("No campaign with that code."); return; }
    if (camp.dm_user_id === userId) { setJoinError("That's your own campaign."); return; }
    const { data: dm } = await db.from("user_profiles").select("display_name").eq("user_id", camp.dm_user_id).maybeSingle();
    setJoinPreview({ campaign: camp as Campaign, dmName: dm?.display_name ?? "Unknown DM" });
  }

  async function confirmJoin() {
    if (!joinPreview) return;
    setJoining(true);
    const characterId = playerCharacters.find((c) => c.id === activeCharacterId)?.id ?? playerCharacters[0]?.id ?? null;
    const { error } = await db.from("campaign_members").insert({
      campaign_id: joinPreview.campaign.id,
      player_user_id: userId,
      character_id: characterId,
    });
    setJoining(false);
    if (error) {
      setJoinError(String(error.message).includes("duplicate") ? "You already joined this campaign." : error.message);
      return;
    }
    setJoinCode(""); setJoinPreview(null);
    await refresh();
  }

  async function setMembershipCharacter(id: string, characterId: string | null) {
    await db.from("campaign_members").update({ character_id: characterId }).eq("id", id);
    await refresh();
  }

  async function leaveCampaign(id: string) {
    if (!confirm("Leave this campaign?")) return;
    await db.from("campaign_members").delete().eq("id", id);
    await refresh();
  }

  return (
    <div className="space-y-4">
      {/* JOIN */}
      <div>
        <div className="text-xs text-[var(--color-muted)] mb-1">Join a campaign</div>
        <div className="flex gap-2">
          <input
            className="j-input flex-1 uppercase tracking-widest"
            placeholder="Enter code"
            value={joinCode}
            maxLength={12}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <button className="j-btn j-btn-ghost" onClick={lookupCode}>Preview</button>
        </div>
        {joinError && <div className="text-xs text-[var(--color-blood)] italic mt-1">{joinError}</div>}
        {joinPreview && (
          <div className="j-card mt-2">
            <div className="j-glow-text">Join <b>{joinPreview.campaign.name}</b>?</div>
            <div className="text-xs text-[var(--color-muted)]">DM: {joinPreview.dmName}</div>
            {joinPreview.campaign.description && (
              <div className="text-xs italic mt-1">{joinPreview.campaign.description}</div>
            )}
            {playerCharacters.length === 0 ? (
              <div className="text-xs text-[var(--color-blood)] italic mt-2">Create a player character first.</div>
            ) : (
              <div className="text-[11px] text-[var(--color-muted)] mt-2">
                Sharing "{playerCharacters.find((c) => c.id === activeCharacterId)?.name ?? playerCharacters[0].name}" — you can change per-campaign after joining.
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <button className="j-btn" disabled={joining || playerCharacters.length === 0} onClick={confirmJoin}>
                {joining ? "Joining…" : "Confirm Join"}
              </button>
              <button className="j-btn j-btn-ghost" onClick={() => { setJoinPreview(null); setJoinCode(""); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* MY MEMBERSHIPS */}
      {memberships.length > 0 && (
        <div>
          <div className="text-xs text-[var(--color-muted)] mb-1">Campaigns you're in</div>
          <div className="space-y-2">
            {memberships.map((mv) => (
              <div key={mv.membership.id} className="j-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="j-glow-text truncate">📖 {mv.campaign.name}</div>
                    <div className="text-[11px] text-[var(--color-muted)]">DM: {mv.dm_display_name}</div>
                  </div>
                  <button className="j-btn j-btn-ghost !py-1 !px-2 text-xs" onClick={() => leaveCampaign(mv.membership.id)}>Leave</button>
                </div>
                {playerCharacters.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-[11px] text-[var(--color-muted)]">Sharing:</label>
                    <select
                      className="j-input flex-1 text-xs"
                      value={mv.membership.character_id ?? ""}
                      onChange={(e) => setMembershipCharacter(mv.membership.id, e.target.value || null)}
                    >
                      <option value="">— none —</option>
                      {playerCharacters.map((c) => (
                        <option key={c.id} value={c.id}>{c.name || "Unnamed"}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DM SECTION */}
      <div>
        <div className="text-xs text-[var(--color-muted)] mb-1">Campaigns you run (DM)</div>
        <div className="j-card space-y-2">
          <input className="j-input w-full" placeholder="Campaign name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input className="j-input w-full" placeholder="Short description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <button className="j-btn w-full" disabled={creating || !newName.trim()} onClick={createCampaign}>
            {creating ? "Creating…" : "＋ Create Campaign"}
          </button>
        </div>
        {dmCampaigns.length > 0 && (
          <div className="space-y-2 mt-2">
            {dmCampaigns.map((c) => (
              <div key={c.id} className="j-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="j-glow-text truncate">🏰 {c.name}</div>
                    {c.description && <div className="text-[11px] italic text-[var(--color-muted)]">{c.description}</div>}
                  </div>
                  <button className="j-btn j-btn-ghost !py-1 !px-2 text-xs" onClick={() => deleteCampaign(c.id)}>✕</button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="text-[11px] text-[var(--color-muted)]">Join code:</div>
                  <code className="j-glow-text tracking-widest">{c.join_code}</code>
                  <button
                    className="j-btn j-btn-ghost !py-1 !px-2 text-xs"
                    onClick={() => navigator.clipboard?.writeText(c.join_code)}
                    title="Copy"
                  >📋</button>
                  <button className="j-btn j-btn-ghost !py-1 !px-2 text-xs" onClick={() => regenCode(c.id)} title="Regenerate">↻</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
