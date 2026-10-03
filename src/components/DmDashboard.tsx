import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  Abilities, Attack, Campaign, Character, Currency, Equipment,
  Skill, Spell, SpellMeta, Traits,
} from "@/lib/types";
import { abilityMod, fmtMod, formatMulticlass, totalLevel } from "@/lib/types";
import { DmSheetView } from "./DmSheetView";
import { WorldMapPanel } from "./map/WorldMapPanel";
import { CombatTracker } from "./combat/CombatTracker";

const db = supabase as any;

type Member = {
  membership_id: string;
  player_user_id: string;
  player_name: string;
  character_id: string | null;
  share_sheet_with_dm: boolean;
  character?: Character;
};

type CampaignWithMembers = {
  campaign: Campaign;
  members: Member[];
  sessionCount: number;
  pendingHomebrew: number;
};

type SheetBundle = {
  character: Character;
  abilities: Abilities | null;
  skills: Skill[];
  attacks: Attack[];
  spells: Spell[];
  spellMeta: SpellMeta | null;
  traits: Traits | null;
  equipment: Equipment[];
  currency: Currency | null;
};

export function DmDashboardButton({ userId }: { userId: string }) {
  const [isGm, setIsGm] = useState(false);
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await db.from("user_preferences").select("is_gm").eq("user_id", userId).maybeSingle();
      setIsGm(!!data?.is_gm);
    })();
  }, [userId]);

  useEffect(() => {
    if (!isGm) return;
    let alive = true;
    async function loadCount() {
      const { data } = await db.from("gm_notifications").select("id").eq("gm_user_id", userId).eq("is_read", false);
      if (alive) setPendingCount((data ?? []).length);
    }
    loadCount();
    const ch = supabase
      .channel("dm-badge-" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "gm_notifications", filter: `gm_user_id=eq.${userId}` }, loadCount)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [isGm, userId]);

  if (!isGm) return null;

  return (
    <>
      <button
        className="j-menu-item"
        onClick={() => setOpen(true)}
        aria-current={open ? "true" : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="DM Dashboard"
      >
        <span>DM Dashboard</span>
        {pendingCount > 0 && <span className="j-menu-count">{pendingCount}</span>}
      </button>
      {open && <DmDashboard userId={userId} onClose={() => setOpen(false)} />}
    </>
  );
}

function DmDashboard({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [rows, setRows] = useState<CampaignWithMembers[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<{ character: Character; playerName: string; campaignName: string } | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [view, setView] = useState<"roster" | "map" | "journal" | "combat" | "settings">("roster");
  const [activeCombat, setActiveCombat] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data: camps } = await db.from("campaigns").select("*").eq("dm_user_id", userId).order("created_at", { ascending: false });
    const campaigns = (camps ?? []) as Campaign[];
    if (campaigns.length === 0) { setRows([]); setLoading(false); return; }
    const campaignIds = campaigns.map((c) => c.id);
    const { data: mems } = await db.from("campaign_members").select("*").in("campaign_id", campaignIds);
    const memList = (mems ?? []) as { id: string; campaign_id: string; player_user_id: string; character_id: string | null; share_sheet_with_dm?: boolean }[];
    const playerIds = Array.from(new Set(memList.map((m) => m.player_user_id)));
    const characterIds = memList.map((m) => m.character_id).filter(Boolean) as string[];

    const [profRes, charRes, sessRes, notifRes, combatRes] = await Promise.all([
      playerIds.length ? db.from("user_profiles").select("user_id,display_name").in("user_id", playerIds) : Promise.resolve({ data: [] }),
      characterIds.length ? db.from("characters").select("*").in("id", characterIds) : Promise.resolve({ data: [] }),
      characterIds.length ? db.from("sessions").select("id,character_id").in("character_id", characterIds) : Promise.resolve({ data: [] }),
      db.from("gm_notifications").select("id,from_character_id,is_read").eq("gm_user_id", userId).eq("is_read", false),
      db.from("combat_sessions").select("campaign_id").in("campaign_id", campaignIds).eq("is_active", true),
    ]);
    const nameMap = new Map<string, string>((profRes.data ?? []).map((p: any) => [p.user_id, p.display_name]));
    const charMap = new Map<string, Character>((charRes.data ?? []).map((c: any) => [c.id, c as Character]));

    const sessionsByChar = new Map<string, number>();
    for (const s of (sessRes.data ?? []) as { character_id: string }[]) {
      sessionsByChar.set(s.character_id, (sessionsByChar.get(s.character_id) ?? 0) + 1);
    }
    const pendingByChar = new Map<string, number>();
    for (const n of (notifRes.data ?? []) as { from_character_id: string | null }[]) {
      if (!n.from_character_id) continue;
      pendingByChar.set(n.from_character_id, (pendingByChar.get(n.from_character_id) ?? 0) + 1);
    }

    const out: CampaignWithMembers[] = campaigns.map((c) => {
      const members = memList.filter((m) => m.campaign_id === c.id).map((m) => ({
        membership_id: m.id,
        player_user_id: m.player_user_id,
        player_name: nameMap.get(m.player_user_id) ?? "Unknown Adventurer",
        character_id: m.character_id,
        share_sheet_with_dm: !!m.share_sheet_with_dm,
        character: m.character_id ? charMap.get(m.character_id) : undefined,
      }));
      let sessionCount = 0;
      let pendingHomebrew = 0;
      for (const m of members) {
        if (m.character_id) {
          sessionCount += sessionsByChar.get(m.character_id) ?? 0;
          pendingHomebrew += pendingByChar.get(m.character_id) ?? 0;
        }
      }
      return { campaign: c, members, sessionCount, pendingHomebrew };
    });

    setRows(out);
    setActiveCombat(Object.fromEntries((combatRes.data ?? []).map((c: any) => [c.campaign_id, true])));
    setSelectedCampaignId((prev) => prev && out.some((r) => r.campaign.id === prev) ? prev : out[0]?.campaign.id ?? null);
    setLoading(false);
  }, [userId]);

  async function requestAccess(m: Member, campaign: Campaign) {
    setRequesting(m.membership_id);
    const { data: prof } = await db.from("user_profiles").select("display_name").eq("user_id", userId).maybeSingle();
    const dmName = prof?.display_name ?? "Your DM";
    await db.from("player_notifications").insert({
      player_user_id: m.player_user_id,
      from_user_id: userId,
      campaign_id: campaign.id,
      membership_id: m.membership_id,
      character_id: m.character_id,
      kind: "sheet_access_request",
      message: `📖 ${dmName} from campaign ${campaign.name} is requesting access to view your character sheet.`,
    });
    setRequested((r) => ({ ...r, [m.membership_id]: true }));
    setRequesting(null);
  }

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("dm-dash-members-" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_members" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns", filter: `dm_user_id=eq.${userId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "player_notifications", filter: `from_user_id=eq.${userId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "combat_sessions" }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "characters" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  const selected = useMemo(
    () => rows.find((r) => r.campaign.id === selectedCampaignId) ?? null,
    [rows, selectedCampaignId],
  );

  // Sync notes draft when campaign switches
  useEffect(() => {
    setNotesDraft(selected?.campaign.session_notes ?? "");
  }, [selectedCampaignId, selected?.campaign.session_notes]);

  const saveNotes = async () => {
    if (!selected) return;
    setNotesSaving(true);
    await db.from("campaigns").update({ session_notes: notesDraft }).eq("id", selected.campaign.id);
    setNotesSaving(false);
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1400);
    } catch { /* noop */ }
  };

  async function createCampaign() {
    const name = window.prompt("Name your new campaign");
    if (!name?.trim()) return;
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    await db.from("campaigns").insert({ dm_user_id: userId, name: name.trim(), join_code: code });
    load();
  }

  async function regenerateCode() {
    if (!selected) return;
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    await db.from("campaigns").update({ join_code: code }).eq("id", selected.campaign.id);
    load();
  }

  return (
    <>
      {/* Full-screen DM mode — darker, more authoritative palette */}
      <div
        className="fixed inset-0 z-[80] flex flex-col j-fade"
        style={{
          background: "linear-gradient(180deg, #0a0806 0%, #12100c 100%)",
          color: "var(--color-ink)",
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Top nav */}
        <header
          className="flex items-center justify-between px-4 md:px-6 py-3 border-b"
          style={{
            background: "linear-gradient(180deg, rgba(20,15,10,0.9), rgba(10,8,6,0.9))",
            borderColor: "rgba(255,106,0,0.25)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl">🏰</span>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Dungeon Master Mode</div>
              <h2 className="j-h text-lg md:text-xl truncate">DM Dashboard</h2>
            </div>
          </div>
          <button onClick={onClose} className="j-btn j-btn-ghost !py-1.5 !px-3 text-sm" aria-label="Close">
            ← Back to Journal
          </button>
        </header>

        {/* Two-panel body */}
        <div className="flex-1 flex min-h-0">
          {/* Sidebar: campaign list */}
          <aside
            className={`${selectedCampaignId ? "hidden md:block" : "block"} w-full md:w-72 lg:w-80 shrink-0 border-r overflow-y-auto`}
            style={{
              background: "rgba(8,6,4,0.6)",
              borderColor: "rgba(255,106,0,0.18)",
            }}
          >
            <div className="p-3">
              <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] px-2 mb-2">Campaigns</div>
              <button className="j-btn w-full mb-3" onClick={createCampaign}>＋ New Campaign</button>
              {loading && <div className="text-[var(--color-muted)] italic text-sm px-2">Gathering scrolls…</div>}
              {!loading && rows.length === 0 && (
                <div className="text-xs italic text-[var(--color-muted)] px-2 py-4 leading-relaxed">
                  No campaigns yet. Create your first realm and invite the party.
                </div>
              )}
              <div className="space-y-2">
                {rows.map(({ campaign, members }) => {
                  const active = campaign.id === selectedCampaignId;
                  const playerCount = members.length;
                  return (
                    <button
                      key={campaign.id}
                      onClick={() => setSelectedCampaignId(campaign.id)}
                      className="w-full text-left p-3 rounded-xl transition-all"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, rgba(255,106,0,0.15), rgba(255,106,0,0.05))"
                          : "rgba(20,15,10,0.7)",
                        border: `1px solid ${active ? "rgba(255,106,0,0.5)" : "rgba(255,106,0,0.15)"}`,
                        boxShadow: active
                          ? "0 2px 12px rgba(255,106,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05)"
                          : "inset 0 1px 0 rgba(255,255,255,0.03)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="j-glow-text text-sm truncate" style={{ fontFamily: "var(--font-uncial)" }}>
                            {campaign.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                              style={{
                                background: playerCount > 0 ? "rgba(50,200,120,0.15)" : "rgba(150,150,150,0.12)",
                                color: playerCount > 0 ? "rgb(120,220,160)" : "var(--color-muted)",
                                border: `1px solid ${playerCount > 0 ? "rgba(50,200,120,0.3)" : "rgba(150,150,150,0.2)"}`,
                              }}
                            >
                              {playerCount > 0 ? "● Active" : "○ Empty"}
                            </span>
                            <span className="text-[10px] text-[var(--color-muted)]">
                              👥 {playerCount}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div
                        className="flex items-center gap-1 mt-2 text-[10px] text-[var(--color-muted)]"
                        onClick={(e) => { e.stopPropagation(); copyCode(campaign.join_code); }}
                        role="button"
                        tabIndex={-1}
                      >
                        <code className="tracking-widest">{campaign.join_code}</code>
                        <span className="ml-1 opacity-70 hover:opacity-100">
                          {copiedCode === campaign.join_code ? "✓ copied" : "📋 copy"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Main area */}
          <main className="flex-1 overflow-y-auto">
            {!selected && !loading && (
              <div className="p-6 text-center mt-20">
                <div className="text-6xl mb-4">⚔️</div>
                <h2 className="j-h text-2xl">Select a campaign or create your first one</h2>
                <button className="j-btn mt-5" onClick={createCampaign}>Create Campaign</button>
              </div>
            )}
            {selected && (
              <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
                {/* Mobile back */}
                <button
                  className="md:hidden j-btn j-btn-ghost !py-1 !px-3 text-xs"
                  onClick={() => setSelectedCampaignId(null)}
                >
                  ← Campaigns
                </button>

                {/* Campaign header */}
                 <div className="flex items-start gap-3 flex-wrap">
                   <div className="min-w-0 flex-1">
                   <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Campaign</div>
                   <div className="flex items-center gap-2"><h1 className="j-glow-text text-2xl md:text-3xl" style={{ fontFamily: "var(--font-uncial)" }}>{selected.campaign.name}</h1><span className="text-[9px] uppercase rounded-full px-2 py-1 border border-[rgba(50,200,120,.35)] text-[rgb(120,220,160)]">● Active</span></div>
                  {selected.campaign.description && (
                    <p className="text-sm text-[var(--color-muted)] italic mt-1">{selected.campaign.description}</p>
                  )}
                   <div className="flex items-center gap-2 mt-2 text-xs text-[var(--color-muted)] flex-wrap">
                    <span>Join code:</span>
                    <code className="tracking-widest text-[var(--color-ink)] px-2 py-0.5 rounded" style={{ background: "rgba(255,106,0,0.08)" }}>
                      {selected.campaign.join_code}
                    </code>
                    <button
                      className="j-btn j-btn-ghost !py-0.5 !px-2 text-[10px]"
                      onClick={() => copyCode(selected.campaign.join_code)}
                    >
                      {copiedCode === selected.campaign.join_code ? "✓ Copied" : "📋 Copy"}
                    </button>
                     <button className="j-btn j-btn-ghost !py-0.5 !px-2 text-[10px]" onClick={() => copyCode(`${window.location.origin}/?join=${selected.campaign.join_code}`)}>🔗 Invite Link</button>
                     <button className="j-btn j-btn-ghost !py-0.5 !px-2 text-[10px]" onClick={regenerateCode}>⟳ Regenerate</button>
                  </div>
                   </div>
                </div>

                {/* Section tabs */}
                 <div className="flex gap-1 overflow-x-auto border-b border-[rgba(255,106,0,.2)]">
                   {([["roster", "👥 Player Roster"], ["map", "🗺️ World Map"], ["journal", "📖 Campaign Journal"], ["combat", "⚔️ Combat"], ["settings", "⚙️ Settings"]] as const).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setView(id)}
                      aria-current={view === id ? "true" : undefined}
                       className={`j-tab ${view === id ? "active" : ""}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {view === "map" && <WorldMapPanel campaignId={selected.campaign.id} userId={userId} />}
                 {view === "combat" && <CombatTracker campaignId={selected.campaign.id} members={selected.members} />}
                 {view === "journal" && <section className="j-card"><h3 className="j-h text-lg">Campaign Journal</h3><p className="text-sm text-[var(--color-muted)] mt-1">Shared chronicles and approved lore will appear here.</p></section>}
                 {view === "settings" && <section className="j-card space-y-2"><h3 className="j-h text-lg">Campaign Settings</h3><label className="text-[10px] uppercase text-[var(--color-muted)]">Private DM notes</label><textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} onBlur={saveNotes} rows={8} className="j-input w-full" /><div className="text-[10px] text-[var(--color-muted)]">{notesSaving ? "Saving…" : "Saved when you click away."}</div></section>}

                {view === "roster" && (<>
                {/* Campaign Overview */}
                <section
                  className="rounded-2xl p-4 md:p-5"
                  style={{
                    background: "linear-gradient(135deg, rgba(30,22,14,0.7), rgba(18,14,10,0.7))",
                    border: "1px solid rgba(255,106,0,0.2)",
                    boxShadow: "0 2px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-3">Campaign Overview</div>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                    <StatBubble label="Players" value={selected.members.length} icon="👥" />
                    <StatBubble label="Sessions" value={selected.sessionCount} icon="📜" />
                    <StatBubble
                      label="Pending Homebrew"
                      value={selected.pendingHomebrew}
                      icon="⏳"
                      accent={selected.pendingHomebrew > 0}
                    />
                     <StatBubble label="Combat" value={activeCombat[selected.campaign.id] ? 1 : 0} icon="⚔️" accent={activeCombat[selected.campaign.id]} />
                  </div>
                  <div className="mt-4">
                    <label className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] block mb-1">
                      Session Notes
                    </label>
                    <textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      onBlur={saveNotes}
                      rows={4}
                      placeholder="Write your private DM notes for this campaign…"
                      className="w-full rounded-xl px-3 py-2 text-sm"
                      style={{
                        background: "rgba(8,6,4,0.6)",
                        border: "1px solid rgba(255,106,0,0.2)",
                        color: "var(--color-ink)",
                        resize: "vertical",
                      }}
                    />
                    <div className="text-[10px] text-[var(--color-muted)] mt-1 h-3">
                      {notesSaving ? "Saving…" : "Auto-saves when you click away."}
                    </div>
                  </div>
                </section>

                {/* Roster */}
                <section>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-2">
                    Player Roster · {selected.members.length}
                  </div>
                  {selected.members.length === 0 && (
                    <div
                      className="rounded-xl p-4 text-xs italic text-[var(--color-muted)]"
                      style={{ background: "rgba(20,15,10,0.5)", border: "1px dashed rgba(255,106,0,0.2)" }}
                    >
                      No players yet. Share the join code above to invite adventurers.
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    {selected.members.map((m) => (
                      <RosterCard
                        key={m.membership_id}
                        member={m}
                        requesting={requesting === m.membership_id}
                        requested={!!requested[m.membership_id]}
                        onRequest={() => requestAccess(m, selected.campaign)}
                        onToggleLevelUp={async (v) => {
                          if (!m.character_id) return;
                          const { error } = await db.rpc("dm_set_level_up", { _character_id: m.character_id, _pending: v });
                          if (!error) load();
                        }}
                        onView={() =>
                          m.character &&
                          setSelectedSheet({
                            character: m.character,
                            playerName: m.player_name,
                            campaignName: selected.campaign.name,
                          })
                        }
                      />
                    ))}
                  </div>
                </section>
                </>)}
              </div>
            )}
          </main>
        </div>
      </div>

      {selectedSheet && (
        <DmSheetView
          character={selectedSheet.character}
          playerName={selectedSheet.playerName}
          campaignName={selectedSheet.campaignName}
          onClose={() => setSelectedSheet(null)}
        />
      )}
    </>
  );
}

function StatBubble({ label, value, icon, accent }: { label: string; value: number; icon: string; accent?: boolean }) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{
        background: accent
          ? "linear-gradient(135deg, rgba(255,106,0,0.18), rgba(255,106,0,0.06))"
          : "rgba(8,6,4,0.55)",
        border: `1px solid ${accent ? "rgba(255,106,0,0.4)" : "rgba(255,106,0,0.15)"}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <div className="text-lg">{icon}</div>
      <div className="j-glow-text text-xl leading-tight">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-[var(--color-muted)] mt-0.5">{label}</div>
    </div>
  );
}

function RosterCard({ member, onView, onRequest, requesting, requested, onToggleLevelUp }: {
  member: Member; onView: () => void; onRequest: () => void; requesting: boolean; requested: boolean;
  onToggleLevelUp: (pending: boolean) => void;
}) {
  const c = member.character;
  const shared = member.share_sheet_with_dm;

  return (
    <div
      className="rounded-2xl p-4 flex gap-3 transition-all"
      style={{
        background: "linear-gradient(135deg, rgba(28,20,14,0.75), rgba(16,12,9,0.75))",
        border: "1px solid rgba(255,106,0,0.2)",
        boxShadow: "0 2px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Portrait */}
      <div className="shrink-0">
        {c?.image_url ? (
          <img
            src={c.image_url}
            alt=""
            className="w-20 h-20 rounded-xl object-cover"
            style={{ border: "1px solid rgba(255,106,0,0.35)", boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
          />
        ) : (
          <div
            className="w-20 h-20 rounded-xl flex items-center justify-center text-3xl"
            style={{ background: "rgba(8,6,4,0.6)", border: "1px solid rgba(255,106,0,0.2)" }}
          >
            {c ? "⚔️" : "👤"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-[var(--color-muted)] truncate">👤 {member.player_name}</div>
        {c ? (
          <>
            <div className="j-glow-text text-base truncate">{c.name || "Unnamed"}</div>
            <div className="text-[11px] text-[var(--color-muted)] truncate">
              {formatMulticlass(c.class_level, c.class_level_2) || "—"}
              {c.race ? ` · ${c.race}` : ""}
            </div>
            <div className="text-[10px] text-[var(--color-muted)] mt-0.5">Level {totalLevel(c)}</div>

            {/* At-a-glance vitals */}
            <div className="flex gap-2 mt-2">
              <MiniStat label="HP" value={`${c.hp_current}/${c.hp_max}`} />
              <MiniStat label="AC" value={c.armor_class} />
              <MiniStat label="SPD" value={c.speed} />
            </div>

            <div className="mt-2">
              {c.pending_level_up ? (
                <button onClick={() => onToggleLevelUp(false)} className="j-btn j-btn-ghost lvl-glow !py-1 !px-3 text-xs w-full">
                  ⏳ Level Up Pending · Revoke
                </button>
              ) : (
                <button onClick={() => onToggleLevelUp(true)} className="j-btn !py-1 !px-3 text-xs w-full">
                  ⬆️ Grant Level Up
                </button>
              )}
            </div>
            <div className="mt-2">
              {shared ? (
                <button
                  onClick={onView}
                  className="j-btn !py-1 !px-3 text-xs w-full"
                  style={{ borderColor: "rgba(255,106,0,0.55)" }}
                >
                  👁 View Full Sheet
                </button>
              ) : (
                <div className="space-y-1.5">
                  <div
                    className="text-[10px] italic px-2 py-1.5 rounded-lg text-center"
                    style={{
                      background: "rgba(120,120,120,0.08)",
                      border: "1px dashed rgba(150,150,150,0.3)",
                      color: "var(--color-muted)",
                    }}
                  >
                    🔒 Access Not Granted
                  </div>
                  <button
                    onClick={onRequest}
                    disabled={requesting || requested}
                    className="j-btn j-btn-ghost !py-1 !px-3 text-xs w-full"
                  >
                    {requested ? "📨 Request Sent" : requesting ? "Sending…" : "📨 Request Access"}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-[11px] italic text-[var(--color-muted)] mt-2">No character linked yet.</div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="flex-1 rounded-lg py-1 text-center"
      style={{
        background: "rgba(8,6,4,0.55)",
        border: "1px solid rgba(255,106,0,0.15)",
      }}
    >
      <div className="text-[9px] uppercase text-[var(--color-muted)] tracking-wider">{label}</div>
      <div className="j-glow-text text-xs leading-tight">{value}</div>
    </div>
  );
}

function ReadOnlySheetModal({ character, onClose }: { character: Character; onClose: () => void }) {
  const [bundle, setBundle] = useState<SheetBundle | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const cid = character.id;
      const [ab, sk, at, sp, sm, tr, eq, cu] = await Promise.all([
        db.from("ability_scores").select("*").eq("character_id", cid).maybeSingle(),
        db.from("skills").select("*").eq("character_id", cid),
        db.from("attacks").select("*").eq("character_id", cid),
        db.from("spells").select("*").eq("character_id", cid).order("spell_level"),
        db.from("spell_meta").select("*").eq("character_id", cid).maybeSingle(),
        db.from("traits").select("*").eq("character_id", cid).maybeSingle(),
        db.from("equipment").select("*").eq("character_id", cid),
        db.from("currency").select("*").eq("character_id", cid).maybeSingle(),
      ]);
      if (!alive) return;
      setBundle({
        character,
        abilities: (ab.data as Abilities) ?? null,
        skills: (sk.data as Skill[]) ?? [],
        attacks: (at.data as Attack[]) ?? [],
        spells: (sp.data as Spell[]) ?? [],
        spellMeta: (sm.data as SpellMeta) ?? null,
        traits: (tr.data as Traits) ?? null,
        equipment: (eq.data as Equipment[]) ?? [],
        currency: (cu.data as Currency) ?? null,
      });
    })();
    return () => { alive = false; };
  }, [character]);

  const c = character;
  const abils = bundle?.abilities;
  const abilRow: { key: keyof Abilities; label: string }[] = [
    { key: "strength", label: "STR" }, { key: "dexterity", label: "DEX" },
    { key: "constitution", label: "CON" }, { key: "intelligence", label: "INT" },
    { key: "wisdom", label: "WIS" }, { key: "charisma", label: "CHA" },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-start md:items-center justify-center p-2 md:p-6 overflow-y-auto j-fade" onClick={onClose}>
      <div
        className="j-page w-full max-w-3xl p-5 md:p-8 pl-10 md:pl-14 relative my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="j-spine" />
        <button onClick={onClose} className="absolute top-3 right-3 j-btn j-btn-ghost !py-1 !px-3" aria-label="Close">✕</button>

        <div className="flex items-start gap-4">
          {c.image_url ? (
            <img src={c.image_url} alt="" className="w-24 h-24 rounded-lg object-cover border border-[rgba(255,106,0,0.3)]" />
          ) : (
            <div className="w-24 h-24 rounded-lg border border-[rgba(255,106,0,0.3)] flex items-center justify-center text-3xl">⚔️</div>
          )}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">👁️ Read-only · shared by player</div>
            <h3 className="j-h text-2xl truncate">{c.name || "Unnamed"}</h3>
            {c.subtitle && <div className="italic text-sm text-[var(--color-muted)] truncate">{c.subtitle}</div>}
            <div className="text-sm mt-1 truncate">
              {formatMulticlass(c.class_level, c.class_level_2) || "—"}
              {c.race ? ` · ${c.race}` : ""}{c.alignment ? ` · ${c.alignment}` : ""}
            </div>
            <div className="text-xs text-[var(--color-muted)]">Level {totalLevel(c)} · PB {fmtMod(c.proficiency_bonus)}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="j-card text-center">
            <div className="text-[10px] uppercase text-[var(--color-muted)]">HP</div>
            <div className="j-glow-text text-lg">{c.hp_current}/{c.hp_max}</div>
          </div>
          <div className="j-card text-center">
            <div className="text-[10px] uppercase text-[var(--color-muted)]">AC</div>
            <div className="j-glow-text text-lg">{c.armor_class}</div>
          </div>
          <div className="j-card text-center">
            <div className="text-[10px] uppercase text-[var(--color-muted)]">Speed</div>
            <div className="j-glow-text text-lg">{c.speed}</div>
          </div>
        </div>

        {abils && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Abilities</div>
            <div className="grid grid-cols-6 gap-2">
              {abilRow.map(({ key, label }) => {
                const score = (abils as any)[key] as number;
                return (
                  <div key={key} className="j-card text-center !p-2">
                    <div className="text-[10px] text-[var(--color-muted)]">{label}</div>
                    <div className="j-glow-text">{fmtMod(abilityMod(score))}</div>
                    <div className="text-[10px] text-[var(--color-muted)]">{score}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {bundle && bundle.skills.length > 0 && (
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Saving Throws</div>
              <div className="j-card text-sm space-y-1">
                {bundle.skills.filter((s) => s.kind === "save").map((s) => (
                  <div key={s.id} className="flex justify-between">
                    <span>{s.proficient ? "● " : "○ "}{s.name}</span>
                    <span className="j-glow-text">{fmtMod(s.modifier)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Skills</div>
              <div className="j-card text-sm space-y-1 max-h-64 overflow-y-auto">
                {bundle.skills.filter((s) => s.kind === "skill").map((s) => (
                  <div key={s.id} className="flex justify-between">
                    <span>{s.proficient ? "● " : "○ "}{s.name}</span>
                    <span className="j-glow-text">{fmtMod(s.modifier)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {bundle && bundle.attacks.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Attacks</div>
            <div className="j-card text-sm space-y-1">
              {bundle.attacks.map((a) => (
                <div key={a.id} className="flex justify-between gap-2">
                  <span className="truncate">🗡️ {a.weapon_name}</span>
                  <span className="text-[var(--color-muted)]">{a.attack_bonus} · {a.damage_dice} {a.damage_type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {bundle && bundle.spells.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">
              Spells {bundle.spellMeta && <>· DC {bundle.spellMeta.spell_save_dc} · Atk {fmtMod(bundle.spellMeta.spell_attack_bonus)}</>}
            </div>
            <div className="j-card text-sm space-y-1 max-h-64 overflow-y-auto">
              {bundle.spells.map((s) => (
                <div key={s.id} className="border-b border-[rgba(255,106,0,0.1)] last:border-0 py-1">
                  <div className="flex justify-between gap-2">
                    <span className="j-glow-text truncate">
                      {s.name}
                      {s.is_homebrew && !s.gm_approved && !s.gm_denied && " ⏳"}
                      {s.is_homebrew && s.gm_approved && " ✅"}
                      {s.is_homebrew && s.gm_denied && " ❌"}
                    </span>
                    <span className="text-xs text-[var(--color-muted)] shrink-0">Lv {s.spell_level} {s.school}</span>
                  </div>
                  {s.description && <div className="text-xs text-[var(--color-muted)] line-clamp-2">{s.description}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {bundle && (bundle.equipment.length > 0 || bundle.currency) && (
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {bundle.equipment.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Equipment</div>
                <div className="j-card text-sm space-y-1 max-h-48 overflow-y-auto">
                  {bundle.equipment.map((e) => (
                    <div key={e.id}>{e.emoji_icon} {e.name} × {e.quantity}</div>
                  ))}
                </div>
              </div>
            )}
            {bundle.currency && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Coin Purse</div>
                <div className="j-card text-sm grid grid-cols-5 gap-1 text-center">
                  <div><div className="text-[10px] text-[var(--color-muted)]">CP</div>{bundle.currency.cp}</div>
                  <div><div className="text-[10px] text-[var(--color-muted)]">SP</div>{bundle.currency.sp}</div>
                  <div><div className="text-[10px] text-[var(--color-muted)]">EP</div>{bundle.currency.ep}</div>
                  <div><div className="text-[10px] text-[var(--color-muted)]">GP</div>{bundle.currency.gp}</div>
                  <div><div className="text-[10px] text-[var(--color-muted)]">PP</div>{bundle.currency.pp}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {(bundle?.traits || c.backstory) && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Roleplay</div>
            <div className="j-card text-sm space-y-2">
              {bundle?.traits?.personality && <div><b>Personality:</b> {bundle.traits.personality}</div>}
              {bundle?.traits?.ideal && <div><b>Ideal:</b> {bundle.traits.ideal}</div>}
              {bundle?.traits?.bond && <div><b>Bond:</b> {bundle.traits.bond}</div>}
              {bundle?.traits?.flaw && <div><b>Flaw:</b> {bundle.traits.flaw}</div>}
              {c.backstory && <div className="whitespace-pre-wrap text-[var(--color-muted)] italic pt-1 border-t border-[rgba(255,106,0,0.1)]">{c.backstory}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
