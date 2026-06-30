import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type Character, MAX_NPCS, MAX_PLAYERS } from "@/lib/types";
import { Embers } from "./Embers";

const db = supabase as any;

export function CharacterSelect({
  characters, onPlay, onCreate, onDeleted, onSignOut,
}: {
  characters: Character[];
  onPlay: (id: string) => void;
  onCreate: () => void;
  onDeleted: () => void;
  onSignOut: () => void;
}) {
  const [confirming, setConfirming] = useState<Character | null>(null);
  const [deleting, setDeleting] = useState(false);

  const players = characters.filter((c) => c.character_type === "player");
  const npcs = characters.filter((c) => c.character_type === "npc");
  const playersAtLimit = players.length >= MAX_PLAYERS;
  const npcsAtLimit = npcs.length >= MAX_NPCS;
  const allAtLimit = playersAtLimit && npcsAtLimit;

  async function doDelete(c: Character) {
    setDeleting(true);
    try {
      const tables = ["ability_scores","skills","attacks","spells","spell_meta","sessions","npcs","equipment","currency","traits","free_notes","character_images"];
      for (const t of tables) {
        await db.from(t).delete().eq("character_id", c.id);
      }
      await db.from("characters").delete().eq("id", c.id);
      setConfirming(null);
      onDeleted();
    } finally { setDeleting(false); }
  }

  return (
    <div className="min-h-screen relative p-4 md:p-6">
      <Embers />
      <header className="max-w-6xl mx-auto flex items-center mb-6 gap-3">
        <div className="j-h text-2xl">🔥 Ember Codex</div>
        <div className="flex-1" />
        <button className="j-btn j-btn-ghost" onClick={onSignOut}>Sign Out</button>
      </header>
      <div className="max-w-6xl mx-auto">
        <h1 className="j-h text-4xl text-center mb-2">Choose Your Character</h1>
        <p className="text-center text-[var(--color-muted)] italic mb-1">
          Players {players.length}/{MAX_PLAYERS} · NPCs {npcs.length}/{MAX_NPCS}
        </p>
        <div className="j-divider-ornate mb-6">✦ ✦ ✦</div>

        <Section
          title="⚔️ Your Player Characters"
          accent="player"
          empty="No heroes yet. Forge one to begin your saga."
          items={players}
          onPlay={onPlay}
          onAsk={setConfirming}
          showNew={!allAtLimit}
          onNew={onCreate}
          atLimit={playersAtLimit}
          limitNote={`${MAX_PLAYERS} player maximum`}
        />

        <div className="h-8" />

        <Section
          title="🎭 Your NPCs"
          accent="npc"
          empty="No NPCs recorded. Add allies, rivals, and shopkeepers."
          items={npcs}
          onPlay={onPlay}
          onAsk={setConfirming}
          showNew={!allAtLimit && players.length > 0 ? false : false /* unified + button above */}
          onNew={onCreate}
          atLimit={npcsAtLimit}
          limitNote={`${MAX_NPCS} NPC maximum`}
        />

        {!allAtLimit && (
          <div className="text-center mt-6">
            <button className="j-btn" onClick={onCreate}>+ New Character</button>
            <p className="text-xs text-[var(--color-muted)] italic mt-2">You will choose Player or NPC next.</p>
          </div>
        )}
        {allAtLimit && (
          <div className="text-center mt-6 text-[var(--color-muted)] italic">
            All slots full. Delete a character to make room.
          </div>
        )}
      </div>

      {confirming && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 j-fade" onClick={() => !deleting && setConfirming(null)}>
          <div className="j-page p-8 max-w-md w-full relative" onClick={(e) => e.stopPropagation()}>
            <div className="j-spine" />
            <div className="pl-4">
              <h3 className="j-h text-2xl mb-3">Delete {confirming.character_type === "npc" ? "NPC" : "Character"}?</h3>
              <p className="mb-6">Are you sure you want to delete <span className="j-glow-text">{confirming.name || "this character"}</span>? This cannot be undone.</p>
              <div className="flex gap-2 justify-end">
                <button className="j-btn j-btn-ghost" onClick={() => setConfirming(null)} disabled={deleting}>Cancel</button>
                <button className="j-btn" onClick={() => doDelete(confirming)} disabled={deleting}>
                  {deleting ? <span className="inline-flex items-center gap-2"><span className="j-spinner" /> Deleting…</span> : "Delete Forever"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title, accent, empty, items, onPlay, onAsk, atLimit, limitNote,
}: {
  title: string;
  accent: "player" | "npc";
  empty: string;
  items: Character[];
  onPlay: (id: string) => void;
  onAsk: (c: Character) => void;
  showNew: boolean;
  onNew: () => void;
  atLimit: boolean;
  limitNote: string;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3 px-1">
        <h2 className="j-h text-xl">{title}</h2>
        <span className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
          {items.length} {atLimit ? `· ${limitNote}` : ""}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="j-card text-center py-8 text-[var(--color-muted)] italic">{empty}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((c) => (
            <div key={c.id}
              className={`j-page p-5 relative hover:shadow-[0_0_28px_-6px_var(--color-ember)] transition ${accent === "npc" ? "border-l-4 !border-l-[#8a5cff]" : "border-l-4 !border-l-[var(--color-ember)]"}`}>
              <div className="j-spine" />
              <div className="pl-4">
                <div className="aspect-square w-full rounded overflow-hidden mb-3 bg-[var(--color-page-2)] flex items-center justify-center">
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-5xl opacity-40">{accent === "npc" ? "🎭" : "⚔️"}</div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="j-h text-2xl truncate">{c.name || "Unnamed"}</h3>
                  <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${accent === "npc" ? "border-[#8a5cff] text-[#b89cff]" : "border-[var(--color-ember)] text-[var(--color-flame)]"}`}>
                    {accent}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-flame)] italic truncate">{c.class_level || c.subtitle || "—"}</p>
                <p className="text-xs text-[var(--color-muted)] truncate">{c.race || "—"}</p>
                <div className="flex gap-2 mt-4">
                  <button className="j-btn flex-1" onClick={() => onPlay(c.id)}>Open</button>
                  <button className="j-btn j-btn-ghost" onClick={() => onAsk(c)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
