import { useEffect, useState } from "react";
import { ExportPdfModal } from "./pdf/ExportPdfModal";
import type { Character } from "@/lib/types";
import { applyThemeVars, type ThemeId } from "./ThemeProvider";
import type { CustomTheme } from "@/lib/themes";
import { CoverTab } from "./tabs/CoverTab";
import { StatsTab } from "./tabs/StatsTab";
import { BackstoryTab } from "./tabs/BackstoryTab";
import { SpellsTab } from "./tabs/SpellsTab";
import { SessionsTab } from "./tabs/SessionsTab";
import { NpcsGearTab } from "./tabs/NpcsGearTab";
import { NotesTab } from "./tabs/NotesTab";

const TABS = [
  { id: "cover", label: "Cover" },
  { id: "stats", label: "Stats" },
  { id: "backstory", label: "Backstory" },
  { id: "spells", label: "Spells" },
  { id: "sessions", label: "Sessions" },
  { id: "npcs", label: "NPCs & Gear" },
  { id: "notes", label: "Notes" },
];

/**
 * Read-only, full-journal view of a player's character for the DM.
 * Every tab renders with readOnly=true so no field is editable and no write is possible.
 */
export function DmSheetView({
  character, playerName, campaignName, onClose,
}: {
  character: Character;
  playerName: string;
  campaignName: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("cover");
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  // Apply the CHARACTER's theme while this view is open, then restore the DM's own theme.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    const prevTheme = el.getAttribute("data-theme");
    const prevInline = el.getAttribute("style") ?? "";
    applyThemeVars(el, (character.theme as ThemeId) || "ember", (character.custom_theme as CustomTheme | null) ?? null);
    return () => {
      if (prevTheme) el.setAttribute("data-theme", prevTheme);
      el.setAttribute("style", prevInline);
    };
  }, [character.id, character.theme, character.custom_theme]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);


  function content(id: string) {
    if (id === "cover") return <CoverTab character={character} onChange={async () => {}} readOnly />;
    if (id === "stats") return <StatsTab character={character} onChange={() => {}} readOnly />;
    if (id === "backstory") return <BackstoryTab character={character} onChange={() => {}} readOnly />;
    if (id === "spells") return <SpellsTab characterId={character.id} readOnly />;
    if (id === "sessions") return <SessionsTab characterId={character.id} readOnly />;
    if (id === "npcs") return <NpcsGearTab characterId={character.id} readOnly />;
    if (id === "notes") return <NotesTab characterId={character.id} readOnly />;
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[110] overflow-y-auto j-fade"
      style={{ background: "var(--color-coal)", color: "var(--color-ink)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`DM view of ${playerName}'s character`}
    >
      {/* DM banner */}
      <div
        className="sticky top-0 z-10 px-3 md:px-6 py-2.5 flex items-center gap-3 flex-wrap"
        style={{
          background: "linear-gradient(180deg, rgba(20,15,10,0.96), rgba(10,8,6,0.94))",
          borderBottom: "1px solid rgba(255,106,0,0.3)",
          backdropFilter: "blur(6px)",
        }}
      >
        <button className="j-btn j-btn-ghost !py-1 !px-3 text-xs" onClick={onClose}>← Back to Campaign</button>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Read-only · no edits possible</div>
          <div className="j-glow-text text-sm md:text-base truncate">
            👁 DM View — {playerName}'s Character
            <span className="text-[var(--color-muted)] text-xs"> · {campaignName}</span>
          </div>
        </div>
        <button className="j-btn !py-1 !px-3 text-xs" onClick={() => setExporting(true)}>
          📄 Export Sheet
        </button>
        {exporting && (
          <ExportPdfModal
            character={character}
            exportNote={`Exported by DM · ${campaignName} · ${new Date().toLocaleDateString()}`}
            onClose={() => setExporting(false)}
          />
        )}
      </div>

      {exportErr && (
        <div className="px-4 py-2 text-xs italic text-[var(--color-blood)]">{exportErr}</div>
      )}

      <div className="max-w-4xl mx-auto p-3 md:p-6">
        <div className="flex gap-1.5 flex-wrap mb-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`j-btn ${tab === t.id ? "" : "j-btn-ghost"} !py-1 !px-3 text-xs`}
              aria-current={tab === t.id ? "page" : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="j-page p-4 md:p-8 pl-8 md:pl-14 relative">
          <div className="j-spine" />
          {content(tab)}
        </div>
      </div>
    </div>
  );
}
