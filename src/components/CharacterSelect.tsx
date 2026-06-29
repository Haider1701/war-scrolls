import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Character } from "@/lib/types";
import { Embers } from "./Embers";

const db = supabase as any;
const MAX = 3;

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
  const atLimit = characters.length >= MAX;

  async function doDelete(c: Character) {
    setDeleting(true);
    try {
      const tables = ["ability_scores","skills","attacks","spells","spell_meta","sessions","npcs","equipment","currency","traits","free_notes"];
      for (const t of tables) {
        await db.from(t).delete().eq("character_id", c.id);
      }
      await db.from("characters").delete().eq("id", c.id);
      setConfirming(null);
      onDeleted();
    } finally { setDeleting(false); }
  }

  return (
    <div className="min-h-screen relative p-6">
      <Embers />
      <header className="max-w-5xl mx-auto flex items-center mb-6">
        <div className="j-h text-2xl">🔥 Ember Codex</div>
        <div className="flex-1" />
        <button className="j-btn j-btn-ghost" onClick={onSignOut}>Sign Out</button>
      </header>
      <div className="max-w-5xl mx-auto">
        <h1 className="j-h text-4xl text-center mb-2">Choose Your Character</h1>
        <p className="text-center text-[var(--color-muted)] italic mb-2">
          {characters.length} / {MAX} Characters
        </p>
        <div className="j-divider-ornate mb-8">✦ ✦ ✦</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {characters.map((c) => (
            <div key={c.id} className="j-page p-5 relative">
              <div className="j-spine" />
              <div className="pl-4">
                <div className="aspect-square w-full rounded overflow-hidden mb-3 bg-[var(--color-page-2)] flex items-center justify-center">
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-5xl opacity-40">⚔️</div>
                  )}
                </div>
                <h2 className="j-h text-2xl truncate">{c.name || "Unnamed"}</h2>
                <p className="text-sm text-[var(--color-flame)] italic truncate">{c.class_level || "—"}</p>
                <p className="text-xs text-[var(--color-muted)] truncate">{c.race || "—"}</p>
                <div className="flex gap-2 mt-4">
                  <button className="j-btn flex-1" onClick={() => onPlay(c.id)}>Play</button>
                  <button className="j-btn j-btn-ghost" onClick={() => setConfirming(c)}>Delete</button>
                </div>
              </div>
            </div>
          ))}

          <button
            className="j-page p-5 relative text-left disabled:opacity-40 disabled:cursor-not-allowed group"
            disabled={atLimit}
            title={atLimit ? "Maximum 3 characters reached. Delete one to create a new character." : "Forge a new character"}
            onClick={onCreate}
          >
            <div className="j-spine" />
            <div className="pl-4 flex flex-col items-center justify-center min-h-[280px]">
              <div className="text-6xl mb-3">＋</div>
              <div className="j-h text-xl">New Character</div>
              <div className="text-xs text-[var(--color-muted)] italic mt-2 text-center">
                {atLimit ? "Maximum 3 reached. Delete one to make room." : "Forge a new soul into the codex"}
              </div>
            </div>
          </button>
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => !deleting && setConfirming(null)}>
          <div className="j-page p-8 max-w-md w-full relative" onClick={(e) => e.stopPropagation()}>
            <div className="j-spine" />
            <div className="pl-4">
              <h3 className="j-h text-2xl mb-3">Delete Character?</h3>
              <p className="mb-6">Are you sure you want to delete <span className="j-glow-text">{confirming.name || "this character"}</span>? This cannot be undone.</p>
              <div className="flex gap-2 justify-end">
                <button className="j-btn j-btn-ghost" onClick={() => setConfirming(null)} disabled={deleting}>Cancel</button>
                <button className="j-btn" onClick={() => doDelete(confirming)} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete Forever"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
