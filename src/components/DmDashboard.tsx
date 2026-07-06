import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  Abilities, Attack, Campaign, Character, Currency, Equipment,
  Skill, Spell, SpellMeta, Traits,
} from "@/lib/types";
import { abilityMod, fmtMod, formatMulticlass, totalLevel } from "@/lib/types";

const db = supabase as any;

type Member = {
  membership_id: string;
  player_user_id: string;
  player_name: string;
  character_id: string | null;
  share_sheet_with_dm: boolean;
  character?: Character;
};


type CampaignWithMembers = { campaign: Campaign; members: Member[] };

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

  // Pending homebrew count (unread notifications)
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
        className="j-btn j-btn-ghost relative"
        onClick={() => setOpen(true)}
        title="DM Dashboard"
      >
        🏰 DM
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 text-[10px] bg-[var(--color-blood)] text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{pendingCount}</span>
        )}
      </button>
      {open && <DmDashboard userId={userId} onClose={() => setOpen(false)} />}
    </>
  );
}

function DmDashboard({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [rows, setRows] = useState<CampaignWithMembers[]>([]);
  const [selected, setSelected] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);

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
    const [profRes, charRes] = await Promise.all([
      playerIds.length ? db.from("user_profiles").select("user_id,display_name").in("user_id", playerIds) : Promise.resolve({ data: [] }),
      characterIds.length ? db.from("characters").select("*").in("id", characterIds) : Promise.resolve({ data: [] }),
    ]);
    const nameMap = new Map<string, string>((profRes.data ?? []).map((p: any) => [p.user_id, p.display_name]));
    const charMap = new Map<string, Character>((charRes.data ?? []).map((c: any) => [c.id, c as Character]));
    const out: CampaignWithMembers[] = campaigns.map((c) => ({
      campaign: c,
      members: memList.filter((m) => m.campaign_id === c.id).map((m) => ({
        membership_id: m.id,
        player_user_id: m.player_user_id,
        player_name: nameMap.get(m.player_user_id) ?? "Unknown Adventurer",
        character_id: m.character_id,
        share_sheet_with_dm: !!m.share_sheet_with_dm,
        character: m.character_id ? charMap.get(m.character_id) : undefined,
      })),
    }));

    setRows(out);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Realtime membership changes
  useEffect(() => {
    const ch = supabase
      .channel("dm-dash-members-" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_members" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/60 j-fade" onClick={onClose} />
      <aside
        className="fixed right-0 top-0 bottom-0 z-[90] w-full md:w-[520px] j-page shadow-2xl overflow-y-auto"
        style={{ borderRadius: 0, animation: "j-drawer-in 0.28s ease-out" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="j-spine" />
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-[color-mix(in_oklab,var(--color-page)_92%,transparent)] backdrop-blur border-b border-[rgba(255,106,0,0.2)]">
          <h2 className="j-h text-xl">🏰 DM Dashboard</h2>
          <button onClick={onClose} className="j-btn j-btn-ghost !py-1 !px-3 text-xl" aria-label="Close">✕</button>
        </div>

        <div className="p-5 pl-8 space-y-6">
          {loading && <div className="text-[var(--color-muted)] italic">Gathering scrolls…</div>}
          {!loading && rows.length === 0 && (
            <div className="j-card text-[var(--color-muted)] italic text-sm">
              You have no campaigns yet. Create one from Settings → Campaigns to invite players.
            </div>
          )}
          {rows.map(({ campaign, members }) => (
            <section key={campaign.id}>
              <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Campaign</div>
              <div className="j-glow-text text-lg" style={{ fontFamily: "var(--font-uncial)" }}>{campaign.name}</div>
              <div className="text-[11px] text-[var(--color-muted)]">Join code: <code className="tracking-widest">{campaign.join_code}</code> · {members.length} member{members.length === 1 ? "" : "s"}</div>
              <div className="space-y-2 mt-2">
                {members.length === 0 && (
                  <div className="text-xs italic text-[var(--color-muted)]">No players yet. Share the join code above.</div>
                )}
                {members.map((m) => (
                  <div key={m.membership_id} className="j-card">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-[var(--color-muted)]">👤 {m.player_name}</div>
                        {m.character ? (
                          <>
                            <div className="j-glow-text truncate">⚔️ {m.character.name || "Unnamed"}</div>
                            <div className="text-[11px] text-[var(--color-muted)] truncate">
                              {formatMulticlass(m.character.class_level, m.character.class_level_2) || "—"}
                              {m.character.race ? ` · ${m.character.race}` : ""}
                            </div>
                          </>
                        ) : (
                          <div className="text-[11px] italic text-[var(--color-muted)]">No character shared.</div>
                        )}
                      </div>
                      {m.character && (
                        <button className="j-btn j-btn-ghost !py-1 !px-3 text-xs" onClick={() => setSelected(m.character!)}>
                          View Sheet
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>

      {selected && <ReadOnlySheetModal character={selected} onClose={() => setSelected(null)} />}
    </>
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

        {/* Vitals */}
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

        {/* Abilities */}
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

        {/* Skills / Saves */}
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

        {/* Attacks */}
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

        {/* Spells */}
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

        {/* Equipment / Currency */}
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

        {/* Traits / Backstory */}
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
