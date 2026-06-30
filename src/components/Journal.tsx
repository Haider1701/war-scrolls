import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Character } from "@/lib/types";
import { Embers } from "./Embers";
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

const MAX = 3;

export function Journal({
  initial, characters, onSwitch, onBackToSelect, onCreateNew, onSignOut,
}: {
  initial: Character;
  characters: Character[];
  onSwitch: (id: string) => void;
  onBackToSelect: () => void;
  onCreateNew: () => void;
  onSignOut: () => void;
}) {
  const [character, setCharacter] = useState<Character>(initial);
  const [tab, setTab] = useState("cover");
  const [readOnly, setReadOnly] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function switchTab(id: string) {
    if (id === tab) return;
    if (readOnly) {
      setFlipping(true);
      setTimeout(() => { setTab(id); setFlipping(false); }, 350);
    } else {
      setTab(id);
    }
  }

  const atLimit = characters.length >= MAX;

  return (
    <div className="min-h-screen relative">
      <Embers />
      <header className="sticky top-0 z-30 backdrop-blur bg-[rgba(16,11,3,0.85)] border-b border-[rgba(255,106,0,0.2)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="j-h text-xl">🔥 Ember Codex</div>

          <div className="relative" ref={menuRef}>
            <button
              className="j-btn j-btn-ghost flex items-center gap-2"
              onClick={() => setMenuOpen((o) => !o)}
              title="Switch character"
            >
              <span className="j-glow-text">{character.name || "Unnamed"}</span>
              <span className="text-xs opacity-70">▾</span>
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 j-page p-2 z-40 shadow-xl">
                {characters.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setMenuOpen(false); if (c.id !== character.id) onSwitch(c.id); }}
                    className={`w-full text-left px-3 py-2 rounded hover:bg-[rgba(255,106,0,0.1)] ${c.id === character.id ? "bg-[rgba(255,106,0,0.15)] border border-[rgba(255,106,0,0.35)]" : ""}`}
                  >
                    <div className="j-glow-text truncate">{c.name || "Unnamed"}</div>
                    <div className="text-xs text-[var(--color-muted)] truncate">{c.class_level || "—"}</div>
                  </button>
                ))}
                <div className="border-t border-[rgba(255,106,0,0.2)] my-2" />
                <button
                  onClick={() => { setMenuOpen(false); onCreateNew(); }}
                  disabled={atLimit}
                  title={atLimit ? "Maximum 3 characters reached. Delete one to create a new character." : ""}
                  className="w-full text-left px-3 py-2 rounded hover:bg-[rgba(255,106,0,0.1)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ＋ New Character
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onBackToSelect(); }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-[rgba(255,106,0,0.1)]"
                >
                  ⌂ All Characters
                </button>
              </div>
            )}
          </div>

          <div className="flex-1" />
          <button className="j-btn j-btn-ghost" onClick={() => setReadOnly(!readOnly)}>
            {readOnly ? "Edit Mode" : "Preview Mode"}
          </button>
          <button className="j-btn j-btn-ghost" onClick={onSignOut}>Sign Out</button>
        </div>
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} className={`j-tab ${tab === t.id ? "active" : ""}`} onClick={() => switchTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8 j-flip-stage">
        <div className={`j-page j-flip-page ${flipping ? "flipping" : ""} relative p-6 md:p-10 pl-12 md:pl-16`}>
          <div className="j-spine" />
          {tab === "cover" && <CoverTab character={character} onChange={async (c) => {
            setCharacter(c);
            await (supabase as any).from("characters").update({
              name: c.name, subtitle: c.subtitle, class_level: c.class_level, class_level_2: c.class_level_2,
              race: c.race, alignment: c.alignment, background: c.background,
              proficiency_bonus: c.proficiency_bonus, passive_perception: c.passive_perception,
              affliction_note: c.affliction_note, image_url: c.image_url,
            }).eq("id", c.id);
          }} readOnly={readOnly} />}
          {tab === "stats" && <StatsTab character={character} onChange={setCharacter} readOnly={readOnly} />}
          {tab === "backstory" && <BackstoryTab character={character} onChange={setCharacter} readOnly={readOnly} />}
          {tab === "spells" && <SpellsTab characterId={character.id} readOnly={readOnly} />}
          {tab === "sessions" && <SessionsTab characterId={character.id} readOnly={readOnly} />}
          {tab === "npcs" && <NpcsGearTab characterId={character.id} readOnly={readOnly} />}
          {tab === "notes" && <NotesTab characterId={character.id} readOnly={readOnly} />}
        </div>
        <p className="text-center text-[var(--color-muted)] italic text-xs mt-4">
          {readOnly ? "Reading mode — pages turn as you walk through them." : "All inscriptions are bound to fire as you write."}
        </p>
      </main>
    </div>
  );
}
