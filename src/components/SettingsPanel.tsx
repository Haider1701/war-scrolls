import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Character } from "@/lib/types";
import { THEMES, fontPair, useTheme, type ThemeId } from "./ThemeProvider";
import type { CustomTheme } from "@/lib/themes";
import { CustomThemeBuilder } from "./CustomThemeBuilder";
import { CampaignsPanel } from "./CampaignsPanel";
import { CampaignBadge } from "./CampaignBadge";
import { GmNotifications } from "./GmNotifications";
import { DmDashboardButton } from "./DmDashboard";
import { PlayerNotifications } from "./PlayerNotifications";

const db = supabase as any;

type LibraryTheme = { id: string; name: string; theme: CustomTheme };

export function SettingsPanel({
  userId,
  characters,
  activeCharacterId,
  onClose,
  onSignOut,
  readOnly,
  onToggleReadOnly,
}: {
  userId: string;
  characters: Character[];
  activeCharacterId: string;
  onClose: () => void;
  onSignOut: () => void;
  readOnly?: boolean;
  onToggleReadOnly?: () => void;
}) {
  const { theme, saveTheme } = useTheme();
  const [isGm, setIsGm] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [library, setLibrary] = useState<LibraryTheme[]>([]);
  const [copyTargetOpen, setCopyTargetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  const activeChar = characters.find((c) => c.id === activeCharacterId) ?? null;

  async function doExport() {
    if (!activeChar) return;
    setExporting(true);
    setExportErr(null);
    try {
      const { exportCharacterPdf } = await import("@/lib/pdf/exportCharacterPdf");
      await exportCharacterPdf(activeChar);
    } catch (e: any) {
      setExportErr(e?.message ?? "Could not create the PDF.");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    (async () => {
      const [{ data: prefs }, { data: lib }] = await Promise.all([
        db.from("user_preferences").select("is_gm").eq("user_id", userId).maybeSingle(),
        db.from("user_custom_themes").select("id,name,theme").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);
      setIsGm(!!prefs?.is_gm);
      setLibrary(lib ?? []);
    })();
  }, [userId]);

  async function toggleGm() {
    const next = !isGm;
    setIsGm(next);
    await db.from("user_preferences").upsert({ user_id: userId, is_gm: next }, { onConflict: "user_id" });
  }

  async function pickPreset(id: ThemeId) {
    await saveTheme({ theme: id, custom_theme: null });
  }

  async function loadFromLibrary(t: LibraryTheme) {
    await saveTheme({ theme: "custom", custom_theme: t.theme });
  }

  async function deleteFromLibrary(id: string) {
    await db.from("user_custom_themes").delete().eq("id", id);
    setLibrary((l) => l.filter((x) => x.id !== id));
  }

  async function copyThemeTo(targetId: string) {
    const active = characters.find((c) => c.id === activeCharacterId);
    if (!active) return;
    await db.from("characters").update({
      theme: active.theme ?? "ember",
      custom_theme: active.custom_theme ?? null,
    }).eq("id", targetId);
    setCopyTargetOpen(false);
  }

  const otherChars = characters.filter((c) => c.id !== activeCharacterId);

  const drawerRef = useRef<HTMLElement | null>(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    if (closing) return;
    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setClosing(true);
    closeTimer.current = window.setTimeout(onClose, reduced ? 0 : 240);
  }, [closing, onClose]);

  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);

  function focusables(): HTMLElement[] {
    const root = drawerRef.current;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
  }

  // Initial focus inside the drawer
  useEffect(() => {
    const first = focusables()[0];
    first?.focus();
  }, []);

  // Escape to close, Tab focus trap, arrow-key navigation across menu rows
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const root = drawerRef.current;
      if (!root) return;
      if (e.key === "Escape") { e.stopPropagation(); requestClose(); return; }

      if (e.key === "Tab") {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (!active || !root.contains(active)) { e.preventDefault(); first.focus(); return; }
        if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const rows = Array.from(root.querySelectorAll<HTMLElement>(".j-menu-item"));
        if (rows.length === 0) return;
        const i = rows.indexOf(document.activeElement as HTMLElement);
        if (i === -1) return;
        e.preventDefault();
        const next = e.key === "ArrowDown"
          ? rows[(i + 1) % rows.length]
          : rows[(i - 1 + rows.length) % rows.length];
        next.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [requestClose]);

  const state = closing ? "closed" : "open";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[80] bg-black/60 j-backdrop"
        data-state={state}
        onClick={requestClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        ref={drawerRef as any}
        id="journal-menu-drawer"
        className="fixed right-0 top-0 bottom-0 z-[90] w-full md:w-[420px] j-page j-drawer shadow-2xl overflow-y-auto"
        data-state={state}
        style={{ borderRadius: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label="Journal menu"
      >
        <div className="j-spine" />
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-[color-mix(in_oklab,var(--color-page)_92%,transparent)] backdrop-blur border-b border-[rgba(255,106,0,0.2)]">
          <h2 className="j-h text-xl">Menu</h2>
          <button
            onClick={requestClose}
            aria-label="Close menu"
            className="j-btn j-btn-ghost !py-1 !px-3 text-xl"
          >✕</button>
        </div>

        <div className="p-5 pl-8 space-y-8">
          {/* NAVIGATION */}
          <section>
            {activeChar && activeChar.character_type === "player" && (
              <div className="mb-3"><CampaignBadge userId={userId} characterId={activeChar.id} /></div>
            )}
            <nav className="j-nav-group" aria-label="Journal navigation">
              {onToggleReadOnly && (
                <button className="j-menu-item" aria-current={readOnly ? "true" : undefined} onClick={onToggleReadOnly}>
                  <span>{readOnly ? "Reading Mode — switch to Editing" : "Editing Mode — switch to Reading"}</span>
                </button>
              )}
              <DmDashboardButton userId={userId} />
              <GmNotifications userId={userId} />
              <PlayerNotifications userId={userId} />
            </nav>
          </section>


          {/* JOURNAL THEME */}
          <section>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-2">Journal Theme (this character)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {THEMES.map((t) => {
                const pair = fontPair(t.fontPairId);
                const selected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => pickPreset(t.id)}
                    className={`j-card text-left transition ${selected ? "ring-2 ring-[var(--color-ember)]" : "opacity-90 hover:opacity-100"}`}
                  >
                    <div className="flex gap-1 mb-2">
                      {t.swatches.map((c) => (
                        <span key={c} className="w-5 h-5 rounded-full border border-black/40" style={{ background: c }} />
                      ))}
                    </div>
                    <div className="j-glow-text text-sm" style={{ fontFamily: `"${pair.heading}", serif` }}>{t.name}</div>
                    <div className="text-xs text-[var(--color-muted)] italic" style={{ fontFamily: `"${pair.body}", serif` }}>{t.description}</div>
                    <div className="text-[10px] text-[var(--color-muted)] mt-1">{pair.label}</div>
                  </button>
                );
              })}
            </div>

            <button
              className={`j-btn w-full mt-3 ${theme === "custom" ? "" : "j-btn-ghost"}`}
              onClick={() => setShowBuilder((s) => !s)}
            >
              {showBuilder ? "Hide" : "Create"} Custom Theme
            </button>

            {showBuilder && <CustomThemeBuilder userId={userId} onClose={() => setShowBuilder(false)} />}

            {library.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-2">My Custom Themes</div>
                <div className="space-y-2">
                  {library.map((t) => {
                    const pair = fontPair(t.theme.fontPairId);
                    return (
                      <div key={t.id} className="j-card flex items-center gap-2">
                        <div className="flex gap-1">
                          {[t.theme.colors.coal, t.theme.colors.ember, t.theme.colors.flame, t.theme.colors.ink]
                            .filter(Boolean).map((c, i) => (
                              <span key={i} className="w-4 h-4 rounded-full border border-black/40" style={{ background: c }} />
                            ))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate" style={{ fontFamily: `"${pair.heading}", serif` }}>{t.name}</div>
                          <div className="text-[10px] text-[var(--color-muted)] truncate">{pair.label}</div>
                        </div>
                        <button className="j-btn j-btn-ghost !py-1 !px-2 text-xs" onClick={() => loadFromLibrary(t)}>Apply</button>
                        <button className="j-btn j-btn-ghost !py-1 !px-2 text-xs" onClick={() => deleteFromLibrary(t.id)}>✕</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {otherChars.length > 0 && (
              <div className="mt-4">
                <button className="j-btn j-btn-ghost w-full" onClick={() => setCopyTargetOpen((o) => !o)}>
                  Copy Theme To…
                </button>
                {copyTargetOpen && (
                  <div className="j-card mt-2 space-y-1">
                    {otherChars.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => copyThemeTo(c.id)}
                        className="w-full text-left px-2 py-1 rounded hover:bg-[rgba(255,106,0,0.1)]"
                      >
                        <span className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">{c.character_type === "npc" ? "NPC" : "PC"}</span>{" "}
                        <span className="j-glow-text">{c.name || "Unnamed"}</span>
                        <span className="text-xs text-[var(--color-muted)]"> — {c.class_level || "—"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ACCOUNT */}
          <section>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-2">Account</div>
            <div className="j-card flex items-center justify-between">
              <div>
                <div className="j-glow-text" style={{ fontFamily: "var(--font-uncial)" }}>Game Master mode</div>
                <div className="text-xs text-[var(--color-muted)] italic">Receive homebrew spell approvals.</div>
              </div>
              <button onClick={toggleGm} className={`j-btn ${isGm ? "" : "j-btn-ghost"}`}>{isGm ? "On" : "Off"}</button>
            </div>
            <button className="j-menu-item mt-2" onClick={onSignOut}><span>Sign Out</span></button>
          </section>

          {/* CAMPAIGN */}
          <section>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-2">Campaigns</div>
            <CampaignsPanel userId={userId} characters={characters} activeCharacterId={activeCharacterId} />
          </section>

          {/* EXPORT */}
          <section>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-2">Export</div>
            <div className="j-card">
              <button className="j-btn w-full" disabled={exporting || !activeChar} onClick={doExport}>
                {exporting ? "Scribing…" : "Export Character Sheet (PDF)"}
              </button>
              {exportErr && <p className="text-xs text-[var(--color-blood)] mt-2">{exportErr}</p>}
              <p className="text-[11px] italic text-[var(--color-muted)] mt-2">
                Three themed pages: Main Sheet, Spellbook, and Chronicle &amp; Notes.
              </p>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
