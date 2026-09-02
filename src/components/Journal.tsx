import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Character } from "@/lib/types";
import { MAX_PLAYERS } from "@/lib/types";
import { Embers } from "./Embers";
import { CoverTab } from "./tabs/CoverTab";
import { StatsTab } from "./tabs/StatsTab";
import { BackstoryTab } from "./tabs/BackstoryTab";
import { SpellsTab } from "./tabs/SpellsTab";
import { SessionsTab } from "./tabs/SessionsTab";
import { NpcsGearTab } from "./tabs/NpcsGearTab";
import { NotesTab } from "./tabs/NotesTab";
import { DiceTrayTab } from "./tabs/DiceTrayTab";
import { SettingsPanel } from "./SettingsPanel";
import { Codex } from "./codex/Codex";
import { PlayerMapTab } from "./map/PlayerMapTab";

const TABS = [
  { id: "cover", label: "Cover" },
  { id: "stats", label: "Stats" },
  { id: "backstory", label: "Backstory" },
  { id: "spells", label: "Spells" },
  { id: "sessions", label: "Sessions" },
  { id: "npcs", label: "NPCs & Gear" },
  { id: "notes", label: "Notes" },
  { id: "dice", label: "Dice Tray" },
];

type FlipDir = "next" | "prev" | null;

export function Journal({
  initial, userId, characters, onSwitch, onBackToSelect, onCreateNew, onSignOut,
}: {
  initial: Character;
  userId: string;
  characters: Character[];
  onSwitch: (id: string) => void;
  onBackToSelect: () => void;
  onCreateNew: () => void;
  onSignOut: () => void;
}) {
  const [character, setCharacter] = useState<Character>(initial);
  const [tab, setTab] = useState("cover");
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [flipDir, setFlipDir] = useState<FlipDir>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const [hasMap, setHasMap] = useState(false);
  const [mapSessionId, setMapSessionId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);



  const tabs = hasMap ? [...TABS, { id: "map", label: "Map" }] : TABS;

  // Does this character's DM have an active campaign map?
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: mems } = await (supabase as any)
        .from("campaign_members").select("campaign_id")
        .eq("player_user_id", userId).eq("character_id", character.id);
      const ids = (mems ?? []).map((m: any) => m.campaign_id);
      if (ids.length === 0) { if (alive) setHasMap(false); return; }
      const { data } = await (supabase as any)
        .from("campaign_maps").select("id").in("campaign_id", ids).eq("is_active", true).limit(1);
      if (alive) setHasMap((data ?? []).length > 0);
    })();
    return () => { alive = false; };
  }, [userId, character.id]);

  // "View on Map" from the Sessions tab
  useEffect(() => {
    function onView(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      setMapSessionId(id);
      setTab("map");
    }
    window.addEventListener("ember:view-on-map", onView as EventListener);
    return () => window.removeEventListener("ember:view-on-map", onView as EventListener);
  }, []);

  const players = characters.filter((c) => c.character_type === "player");

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(id: string) {
    if (id === tab || pendingTab !== null) return;
    if (readOnly) {
      const dir: FlipDir = tabs.findIndex((t) => t.id === id) > tabs.findIndex((t) => t.id === tab) ? "next" : "prev";
      setPendingTab(id);
      setFlipDir(dir);
      window.setTimeout(() => {
        setTab(id);
        setPendingTab(null);
        setFlipDir(null);
      }, 720);
    } else {
      setTab(id);
    }
  }

  function turnRelative(delta: number) {
    const i = tabs.findIndex((t) => t.id === tab);
    const next = tabs[Math.max(0, Math.min(tabs.length - 1, i + delta))];
    if (next.id !== tab) go(next.id);
  }

  // Keyboard arrows in preview mode
  useEffect(() => {
    if (!readOnly) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") turnRelative(1);
      if (e.key === "ArrowLeft") turnRelative(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const atLimit = players.length >= MAX_PLAYERS;

  function tabContent(id: string) {
    if (id === "cover") return <CoverTab character={character} onChange={async (c) => {
      setCharacter(c);
      await (supabase as any).from("characters").update({
        name: c.name, subtitle: c.subtitle, class_level: c.class_level, class_level_2: c.class_level_2,
        race: c.race, alignment: c.alignment, background: c.background,
        proficiency_bonus: c.proficiency_bonus, passive_perception: c.passive_perception,
        affliction_note: c.affliction_note, image_url: c.image_url,
      }).eq("id", c.id);
    }} readOnly={readOnly} />;
    if (id === "stats") return <StatsTab character={character} onChange={setCharacter} readOnly={readOnly} />;
    if (id === "backstory") return <BackstoryTab character={character} onChange={setCharacter} readOnly={readOnly} />;
    if (id === "spells") return <SpellsTab characterId={character.id} readOnly={readOnly} />;
    if (id === "sessions") return <SessionsTab characterId={character.id} readOnly={readOnly} />;
    if (id === "npcs") return <NpcsGearTab characterId={character.id} readOnly={readOnly} />;
    if (id === "notes") return <NotesTab characterId={character.id} readOnly={readOnly} />;
    if (id === "dice") return <DiceTrayTab />;
    if (id === "map") return <PlayerMapTab userId={userId} characterId={character.id} readOnly={readOnly} highlightSessionId={mapSessionId} />;
    return null;
  }

  const tabIdx = tabs.findIndex((t) => t.id === tab);

  if (codexOpen) {
    return <Codex character={character} onClose={() => setCodexOpen(false)} />;
  }

  return (
    <div className="min-h-screen relative">
      <Embers />
      <header className="sticky top-0 z-30 backdrop-blur bg-[rgba(16,11,3,0.85)] border-b border-[rgba(255,106,0,0.2)]">
        <div className="max-w-6xl mx-auto px-3 md:px-4 py-3 flex items-center gap-2 md:gap-3">
          <div className="j-h text-lg md:text-xl shrink-0 j-glow-text">Ember Codex</div>

          <div className="relative min-w-0" ref={menuRef}>
            <button
              className="j-btn j-btn-ghost flex items-center gap-2 !rounded-full"
              onClick={() => setMenuOpen((o) => !o)}
              title="Switch character"
            >
              <span className="j-glow-text truncate max-w-[120px] md:max-w-[200px]">{character.name || "Unnamed"}</span>
              <span className="text-xs opacity-70">▾</span>
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 j-page p-2 z-40 shadow-xl">
                {characters.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setMenuOpen(false); if (c.id !== character.id) onSwitch(c.id); }}
                    className={`w-full text-left px-3 py-2 rounded-xl hover:bg-[rgba(255,106,0,0.1)] transition ${c.id === character.id ? "bg-[rgba(255,106,0,0.15)] border border-[rgba(255,106,0,0.35)]" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] w-8 shrink-0">
                        {c.character_type === "npc" ? "NPC" : "PC"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="j-glow-text truncate">{c.name || "Unnamed"}</div>
                        <div className="text-xs text-[var(--color-muted)] truncate">{c.class_level || c.subtitle || "—"}</div>
                      </div>
                    </div>
                  </button>
                ))}
                <div className="border-t border-[rgba(255,106,0,0.2)] my-2" />
                <button
                  onClick={() => { setMenuOpen(false); onCreateNew(); }}
                  disabled={atLimit}
                  title={atLimit ? "Player character limit reached" : ""}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[rgba(255,106,0,0.1)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  New Character
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onBackToSelect(); }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[rgba(255,106,0,0.1)] transition"
                >
                  All Characters
                </button>
              </div>
            )}
          </div>

          <div className="flex-1" />
          <button className="j-btn shrink-0 mr-1" onClick={() => setCodexOpen(true)}>Codex</button>
          <button
            ref={burgerRef}
            className="j-burger shrink-0"
            aria-label={settingsOpen ? "Close menu" : "Open menu"}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            aria-controls="journal-menu-drawer"
            onClick={() => setSettingsOpen((o) => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
        {settingsOpen && (
          <SettingsPanel
            userId={userId}
            characters={characters}
            activeCharacterId={character.id}
            onClose={() => { setSettingsOpen(false); burgerRef.current?.focus(); }}
            onSignOut={onSignOut}
            readOnly={readOnly}
            onToggleReadOnly={() => setReadOnly((r) => !r)}
          />
        )}
        <div className="max-w-6xl mx-auto px-3 md:px-4 flex gap-1 overflow-x-auto scrollbar-thin">
          {tabs.map((t) => (
            <button key={t.id} className={`j-tab ${tab === t.id ? "active" : ""}`} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-3 md:p-8">
        <div className="j-flip-stage relative">
          {/* Underlying (destination) page, already showing pending content */}
          <div className="j-page relative p-5 md:p-10 pl-12 md:pl-16">
            <div className="j-spine" />
            {tabContent(pendingTab ?? tab)}
          </div>

          {/* Overlay flipping page, showing OLD content as it rotates away */}
          {pendingTab && flipDir && (
            <div className={`j-flip-overlay j-flip-${flipDir}`}>
              <div className="j-page relative p-5 md:p-10 pl-12 md:pl-16 h-full overflow-hidden">
                <div className="j-spine" />
                {tabContent(tab)}
                <div className="j-flip-shade" />
                <div className="j-flip-curl" />
              </div>
            </div>
          )}

          {/* Preview-mode navigation arrows */}
          {readOnly && (
            <>
              <button
                aria-label="Previous page"
                disabled={tabIdx === 0 || pendingTab !== null}
                onClick={() => turnRelative(-1)}
                className="j-page-arrow j-page-arrow-l"
              >‹</button>
              <button
                aria-label="Next page"
                disabled={tabIdx === tabs.length - 1 || pendingTab !== null}
                onClick={() => turnRelative(1)}
                className="j-page-arrow j-page-arrow-r"
              >›</button>
            </>
          )}
        </div>
        <p className="text-center text-[var(--color-muted)] italic text-xs mt-4">
          {readOnly ? "Reading mode — use arrows or ← → to turn pages." : "All inscriptions are bound to fire as you write."}
        </p>
      </main>
    </div>
  );
}
