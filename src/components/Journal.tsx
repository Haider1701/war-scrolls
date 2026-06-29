import { useState } from "react";
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
import { useToast } from "./Toast";

const TABS = [
  { id: "cover", label: "Cover" },
  { id: "stats", label: "Stats" },
  { id: "backstory", label: "Backstory" },
  { id: "spells", label: "Spells" },
  { id: "sessions", label: "Sessions" },
  { id: "npcs", label: "NPCs & Gear" },
  { id: "notes", label: "Notes" },
];

export function Journal({ initial, onSignOut }: { initial: Character; onSignOut: () => void }) {
  const [character, setCharacter] = useState<Character>(initial);
  const [tab, setTab] = useState("cover");
  const [readOnly, setReadOnly] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const toast = useToast();

  function switchTab(id: string) {
    if (id === tab) return;
    if (readOnly) {
      setFlipping(true);
      setTimeout(() => { setTab(id); setFlipping(false); }, 350);
    } else {
      setTab(id);
    }
  }

  return (
    <div className="min-h-screen relative">
      <Embers />
      <header className="sticky top-0 z-30 backdrop-blur bg-[rgba(16,11,3,0.85)] border-b border-[rgba(255,106,0,0.2)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="j-h text-xl">🔥 Ember Codex</div>
          <div className="flex-1" />
          <button className="j-btn j-btn-ghost" title={readOnly ? "Switch to edit" : "Read the book"} onClick={() => setReadOnly(!readOnly)}>
            {readOnly ? "✎ Edit" : "📖 Read"}
          </button>
          <button className="j-btn j-btn-ghost" onClick={onSignOut}>Sign out</button>
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
            // for the cover, individual fields are saved by inputs onChange via supabase update below if not in CoverTab.
            // CoverTab already updates portrait. For inline fields we save here on blur — simpler: just persist all on every change.
            await (supabase as any).from("characters").update({
              name: c.name, subtitle: c.subtitle, class_level: c.class_level,
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
