import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

type Notif = {
  id: string; gm_user_id: string; from_user_id: string;
  from_character_id: string | null; spell_id: string | null;
  message: string; is_read: boolean; created_at: string;
};
type SpellRow = { id: string; name: string; spell_level: number; school: string; description: string; is_homebrew: boolean; gm_approved: boolean; gm_denied: boolean; character_id: string };

export function GmNotifications({ userId }: { userId: string }) {
  const [isGm, setIsGm] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [spells, setSpells] = useState<Record<string, SpellRow>>({});
  const [chars, setChars] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await db.from("user_preferences").select("is_gm").eq("user_id", userId).maybeSingle();
      setIsGm(!!data?.is_gm);
    })();
  }, [userId]);

  async function loadNotifs() {
    const { data } = await db.from("gm_notifications").select("*").eq("gm_user_id", userId).order("created_at", { ascending: false }).limit(50);
    const list: Notif[] = data ?? [];
    setNotifs(list);
    const spellIds = list.map((n) => n.spell_id).filter(Boolean) as string[];
    const charIds = list.map((n) => n.from_character_id).filter(Boolean) as string[];
    if (spellIds.length) {
      const { data: sp } = await db.from("spells").select("*").in("id", spellIds);
      const map: Record<string, SpellRow> = {};
      (sp ?? []).forEach((s: SpellRow) => (map[s.id] = s));
      setSpells(map);
    }
    if (charIds.length) {
      const { data: ch } = await db.from("characters").select("id,name").in("id", charIds);
      const cmap: Record<string, string> = {};
      (ch ?? []).forEach((c: any) => (cmap[c.id] = c.name || "Unnamed"));
      setChars(cmap);
    }
  }

  useEffect(() => {
    if (!isGm) return;
    loadNotifs();
    const ch = supabase
      .channel("gm-notifs-" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "gm_notifications", filter: `gm_user_id=eq.${userId}` }, () => loadNotifs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGm, userId]);

  async function approve(n: Notif) {
    if (!n.spell_id) return;
    await db.from("spells").update({ gm_approved: true, gm_denied: false }).eq("id", n.spell_id);
    await db.from("gm_notifications").update({ is_read: true }).eq("id", n.id);
    loadNotifs();
  }
  async function deny(n: Notif) {
    if (!n.spell_id) return;
    await db.from("spells").update({ gm_approved: false, gm_denied: true }).eq("id", n.spell_id);
    await db.from("gm_notifications").update({ is_read: true }).eq("id", n.id);
    loadNotifs();
  }

  if (!isGm) return null;
  const unread = notifs.filter((n) => !n.is_read).length;

  return (
    <div className="relative">
      <button className="j-btn j-btn-ghost relative" onClick={() => setOpen((o) => !o)} title="GM notifications">
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 text-[10px] bg-[var(--color-blood)] text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[500px] overflow-y-auto j-page p-3 z-40 shadow-xl">
          <div className="pl-2">
            <div className="j-h text-lg mb-2">GM Requests</div>
            {notifs.length === 0 && <div className="text-[var(--color-muted)] italic text-sm py-4 text-center">Nothing pending.</div>}
            {notifs.map((n) => {
              const sp = n.spell_id ? spells[n.spell_id] : undefined;
              const chName = n.from_character_id ? chars[n.from_character_id] : "";
              const status = sp?.gm_approved ? "approved" : sp?.gm_denied ? "denied" : "pending";
              return (
                <div key={n.id} className="j-card mb-2 text-sm">
                  <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">{chName} · {new Date(n.created_at).toLocaleString()}</div>
                  {sp ? (
                    <>
                      <div className="j-glow-text" style={{ fontFamily: "var(--font-uncial)" }}>{sp.name} <span className="text-xs text-[var(--color-muted)]">(Lv {sp.spell_level} {sp.school})</span></div>
                      <div className="text-xs mt-1 max-h-24 overflow-y-auto">{sp.description}</div>
                      {status === "pending" ? (
                        <div className="flex gap-2 mt-2">
                          <button className="j-btn flex-1" onClick={() => approve(n)}>✅ Approve</button>
                          <button className="j-btn j-btn-ghost flex-1" onClick={() => deny(n)}>❌ Deny</button>
                        </div>
                      ) : (
                        <div className={`text-xs italic mt-2 ${status === "approved" ? "text-[var(--color-ally)]" : "text-[var(--color-blood)]"}`}>
                          {status === "approved" ? "✅ Approved" : "❌ Denied"}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="italic text-[var(--color-muted)]">Spell no longer exists.</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
