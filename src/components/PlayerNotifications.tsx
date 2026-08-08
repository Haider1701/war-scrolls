import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

type PlayerNotif = {
  id: string;
  player_user_id: string;
  from_user_id: string;
  campaign_id: string | null;
  membership_id: string | null;
  character_id: string | null;
  kind: string;
  message: string;
  status: string;
  is_read: boolean;
  created_at: string;
};

/** Player-facing notification bell: sheet-access requests from DMs. */
export function PlayerNotifications({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<PlayerNotif[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await db
      .from("player_notifications")
      .select("*")
      .eq("player_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifs((data ?? []) as PlayerNotif[]);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("player-notifs-" + userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_notifications", filter: `player_user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  async function respond(n: PlayerNotif, grant: boolean) {
    setBusy(n.id);
    if (grant && n.membership_id) {
      await db.from("campaign_members").update({ share_sheet_with_dm: true }).eq("id", n.membership_id);
    }
    await db
      .from("player_notifications")
      .update({ status: grant ? "granted" : "declined", is_read: true })
      .eq("id", n.id);
    setBusy(null);
    await load();
  }

  const pending = notifs.filter((n) => n.status === "pending").length;
  if (notifs.length === 0 && pending === 0) {
    return (
      <button className="j-menu-item" onClick={() => { setOpen((o) => !o); load(); }} aria-expanded={open}>
        <span>Notifications</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        className="j-menu-item"
        onClick={() => setOpen((o) => !o)}
        aria-current={open ? "true" : undefined}
        aria-expanded={open}
        title="Notifications"
      >
        <span>Notifications</span>
        {pending > 0 && <span className="j-menu-count">{pending}</span>}
      </button>
      {open && (
        <div className="mt-2 w-full max-h-[440px] overflow-y-auto j-page p-3 shadow-xl" style={{ borderRadius: 12 }}>
          <div className="pl-2">
            <div className="j-h text-lg mb-2">Notifications</div>
            {notifs.length === 0 && (
              <div className="text-[var(--color-muted)] italic text-sm py-4 text-center">Nothing here yet.</div>
            )}
            {notifs.map((n) => (
              <div key={n.id} className="j-card mb-2 text-sm">
                <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
                  {new Date(n.created_at).toLocaleString()}
                </div>
                <div className="mt-1">{n.message}</div>
                {n.status === "pending" ? (
                  <div className="flex gap-2 mt-2">
                    <button className="j-btn flex-1" disabled={busy === n.id} onClick={() => respond(n, true)}>
                      ✅ Grant Access
                    </button>
                    <button className="j-btn j-btn-ghost flex-1" disabled={busy === n.id} onClick={() => respond(n, false)}>
                      ❌ Decline
                    </button>
                  </div>
                ) : (
                  <div className={`text-xs italic mt-2 ${n.status === "granted" ? "text-[var(--color-ally)]" : "text-[var(--color-blood)]"}`}>
                    {n.status === "granted" ? "✅ Access granted" : "❌ Declined"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
