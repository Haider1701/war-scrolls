import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Character, Traits } from "@/lib/types";

const db = supabase as any;

const TRAIT_META: { key: keyof Traits; label: string; color: string; emoji: string }[] = [
  { key: "personality", label: "Personality", color: "var(--color-ember)", emoji: "🔥" },
  { key: "ideal", label: "Ideal", color: "var(--color-flame-2)", emoji: "✨" },
  { key: "bond", label: "Bond", color: "#5fa75f", emoji: "🔗" },
  { key: "flaw", label: "Flaw", color: "var(--color-blood)", emoji: "🩸" },
];

export function BackstoryTab({ character, onChange, readOnly }: {
  character: Character; onChange: (c: Character) => void; readOnly: boolean;
}) {
  const [traits, setTraits] = useState<Traits | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await db.from("traits").select("*").eq("character_id", character.id).maybeSingle();
      setTraits(data ?? { character_id: character.id, personality: "", ideal: "", bond: "", flaw: "" });
    })();
  }, [character.id]);

  async function saveBackstory(v: string) {
    onChange({ ...character, backstory: v });
    await db.from("characters").update({ backstory: v }).eq("id", character.id);
  }
  async function saveTrait(k: keyof Traits, v: string) {
    if (!traits) return;
    const next = { ...traits, [k]: v };
    setTraits(next);
    await db.from("traits").update({ [k]: v }).eq("character_id", character.id);
  }

  const features = character.features ?? [];
  async function setFeatures(next: { title: string; description: string }[]) {
    onChange({ ...character, features: next });
    await db.from("characters").update({ features: next }).eq("id", character.id);
  }

  return (
    <div className="j-fade space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <h3 className="j-h text-xl">📖 Backstory</h3>
          {character.ai_generated && (
            <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-[var(--color-ember)] text-[var(--color-ember)]">
              ✨ AI Generated
            </span>
          )}
          <div className="flex-1" />
          {!readOnly && (
            <button className="j-btn" onClick={() => setGenOpen(true)}>✨ Generate Backstory</button>
          )}
        </div>
        {readOnly ? (
          <div className="j-card whitespace-pre-wrap text-justify" style={{ textIndent: "2em", lineHeight: 1.9 }}>
            {character.backstory || <span className="italic text-[var(--color-muted)]">No tale recorded.</span>}
          </div>
        ) : (
          <textarea
            className="j-textarea text-justify"
            rows={10}
            style={{ textIndent: "2em" }}
            value={character.backstory}
            onChange={(e) => saveBackstory(e.target.value)}
            placeholder="Begin your tale here…"
          />
        )}
        {genOpen && (
          <BackstoryGeneratorModal
            race={character.race}
            klass={formatMulticlass(character.class_level, character.class_level_2)}
            alignment={character.alignment}
            hasExisting={Boolean(character.backstory?.trim())}
            onClose={() => setGenOpen(false)}
            onKeep={async (t) => {
              setGenOpen(false);
              onChange({ ...character, backstory: t, ai_generated: true });
              await db.from("characters").update({ backstory: t, ai_generated: true }).eq("id", character.id);
            }}
          />
        )}
      </div>


      <div>
        <h3 className="j-h text-xl mb-3">✦ Traits</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {TRAIT_META.map((t) => (
            <div key={t.key} className="j-card" style={{ borderColor: t.color, borderWidth: 1 }}>
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: t.color }}>
                {t.emoji} {t.label}
              </div>
              {readOnly ? (
                <div>{(traits as any)?.[t.key] || <span className="italic text-[var(--color-muted)]">unspoken</span>}</div>
              ) : (
                <textarea
                  className="bg-transparent w-full outline-none resize-none"
                  rows={3}
                  value={(traits as any)?.[t.key] ?? ""}
                  onChange={(e) => saveTrait(t.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="j-h text-xl">⚜ Features & Feats</h3>
          {!readOnly && (
            <button className="j-btn" onClick={() => setFeatures([...features, { title: "New Feature", description: "" }])}>
              + Add
            </button>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {features.length === 0 && <div className="text-[var(--color-muted)] italic">No features yet.</div>}
          {features.map((f, i) => (
            <div key={i} className="j-card">
              {readOnly ? (
                <>
                  <div className="j-glow-text mb-1" style={{ fontFamily: "var(--font-uncial)" }}>{f.title}</div>
                  <div className="text-sm">{f.description}</div>
                </>
              ) : (
                <>
                  <input className="j-input mb-2" value={f.title}
                    onChange={(e) => setFeatures(features.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                  <textarea className="bg-transparent w-full outline-none resize-none text-sm" rows={3}
                    value={f.description}
                    onChange={(e) => setFeatures(features.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                  <button className="text-[var(--color-blood)] text-xs mt-2" onClick={() => setFeatures(features.filter((_, j) => j !== i))}>Remove</button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
