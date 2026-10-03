import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Character } from "@/lib/types";
import { abilityMod, formatMulticlass, parseLevel, profBonusForLevel, totalLevel } from "@/lib/types";
import { CharacterGallery } from "../CharacterGallery";
import { LevelUpButton } from "../LevelUpModal";
import { DND_CLASSES, DND_RACES, DND_BACKGROUNDS, DND_ALIGNMENTS } from "@/lib/dnd-data";

const db = supabase as any;

const DATALISTS: Record<string, readonly string[]> = {
  race: DND_RACES,
  alignment: DND_ALIGNMENTS,
  background: DND_BACKGROUNDS,
};

export function CoverTab({ character, onChange, readOnly }: {
  character: Character; onChange: (c: Character) => void; readOnly: boolean;
}) {
  const [wisdom, setWisdom] = useState<number>(10);
  const [perceptionProf, setPerceptionProf] = useState(false);

  // Pull live wisdom + perception proficiency so we can compute passive perception
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [a, s] = await Promise.all([
        db.from("ability_scores").select("wisdom").eq("character_id", character.id).maybeSingle(),
        db.from("skills").select("proficient").eq("character_id", character.id).eq("kind", "skill").eq("name", "Perception").maybeSingle(),
      ]);
      if (cancelled) return;
      setWisdom(a.data?.wisdom ?? 10);
      setPerceptionProf(!!s.data?.proficient);
    })();
    return () => { cancelled = true; };
  }, [character.id]);

  // Derived stats
  const lvl = totalLevel(character);
  const derivedProf = profBonusForLevel(Math.max(1, lvl || 1));
  const derivedPP = 10 + abilityMod(wisdom) + (perceptionProf ? derivedProf : 0);

  useEffect(() => {
    if (character.proficiency_bonus !== derivedProf || character.passive_perception !== derivedPP) {
      const patch = { proficiency_bonus: derivedProf, passive_perception: derivedPP };
      onChange({ ...character, ...patch });
      db.from("characters").update(patch).eq("id", character.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedProf, derivedPP]);

  function setField<K extends keyof Character>(k: K, v: Character[K]) {
    onChange({ ...character, [k]: v });
  }

  const classDisplay = formatMulticlass(character.class_level, character.class_level_2 ?? "");

  return (
    <div className="j-fade">
      <div className="j-card j-vignette relative overflow-hidden mb-4" style={{ minHeight: 260 }}>
        {character.image_url ? (
          <img src={character.image_url} alt={character.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--color-muted)] italic">
            {readOnly ? "No portrait yet" : "Upload images below — the ★ cover appears here."}
          </div>
        )}
      </div>

      <div className="mb-6">
        <CharacterGallery
          characterId={character.id}
          userId={character.user_id}
          readOnly={readOnly}
          onPrimaryChange={(url) => setField("image_url", url)}
        />
      </div>

      <div className="text-center mb-6">
        {readOnly ? (
          <h1 className="j-h text-5xl">{character.name || "Unnamed"}</h1>
        ) : (
          <input
            className="j-h text-5xl bg-transparent text-center w-full outline-none border-b border-dashed border-[rgba(255,106,0,0.25)] focus:border-[var(--color-ember)]"
            value={character.name}
            onChange={(e) => setField("name", e.target.value)}
            maxLength={80}
          />
        )}
        {readOnly ? (
          <p className="italic text-[var(--color-flame)] mt-2 text-lg">{character.subtitle || ""}</p>
        ) : (
          <input
            className="italic text-[var(--color-flame)] mt-2 text-lg bg-transparent text-center w-full outline-none"
            value={character.subtitle}
            placeholder="Subtitle / titles"
            onChange={(e) => setField("subtitle", e.target.value)}
            maxLength={160}
          />
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {/* Class & Level (with multiclass) */}
        <div className="j-card md:col-span-3">
          <div className="flex items-center justify-between mb-1"><div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Class & Level</div><LevelUpButton character={character} readOnly={readOnly} onApplied={onChange} /></div>
          {readOnly ? (
            <div className="j-glow-text" style={{ fontFamily: "var(--font-uncial)", fontSize: "1.1rem" }}>
              {classDisplay || <span className="text-[var(--color-muted)] italic">unset</span>}
              {lvl > 0 && <span className="text-xs text-[var(--color-muted)] ml-2">· total level {lvl}</span>}
            </div>
          ) : (
            <div className="space-y-2">
              <input
                className="j-input"
                placeholder="War Cleric 3"
                list="dnd-classes"
                value={character.class_level}
                onChange={(e) => setField("class_level", e.target.value)}
              />
              <input
                className="j-input"
                placeholder="Second class (optional) — e.g. Fighter 2"
                list="dnd-classes"
                value={character.class_level_2 ?? ""}
                onChange={(e) => setField("class_level_2", e.target.value as any)}
              />
              <datalist id="dnd-classes">
                {DND_CLASSES.flatMap((c) =>
                  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => (
                    <option key={`${c}-${l}`} value={`${c} ${l}`} />
                  )),
                )}
              </datalist>
              <div className="text-[10px] text-[var(--color-muted)] italic">
                Total level: <span className="text-[var(--color-flame)]">{lvl || 0}</span>
                {" · "}Computed proficiency: <span className="text-[var(--color-flame)]">+{derivedProf}</span>
                {(parseLevel(character.class_level) > 0 || parseLevel(character.class_level_2) > 0) ? "" : "  (add a trailing level number to each class to compute)"}
              </div>
            </div>
          )}
        </div>

        {/* Race / Alignment / Background */}
        {(["race","alignment","background"] as const).map((k) => (
          <div key={k} className="j-card">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">{k}</div>
            {readOnly ? (
              <div className="j-glow-text" style={{ fontFamily: "var(--font-uncial)", fontSize: "1.05rem" }}>
                {character[k] || <span className="text-[var(--color-muted)] italic">unset</span>}
              </div>
            ) : (
              <>
                <input
                  className="j-input"
                  value={character[k]}
                  list={`dnd-${k}`}
                  onChange={(e) => setField(k, e.target.value)}
                />
                <datalist id={`dnd-${k}`}>
                  {DATALISTS[k].map((v) => <option key={v} value={v} />)}
                </datalist>
              </>
            )}
          </div>
        ))}

        {/* Proficiency — derived, read-only */}
        <div className="j-card">
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Proficiency</div>
          <div className="j-glow-text" style={{ fontFamily: "var(--font-uncial)", fontSize: "1.1rem" }}>+{derivedProf}</div>
          <div className="text-[10px] italic text-[var(--color-muted)]">auto · from total level</div>
        </div>

        {/* Passive Perception — derived, read-only */}
        <div className="j-card">
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Passive Perception</div>
          <div className="j-glow-text" style={{ fontFamily: "var(--font-uncial)", fontSize: "1.1rem" }}>{derivedPP}</div>
          <div className="text-[10px] italic text-[var(--color-muted)]">10 + WIS mod{perceptionProf ? " + prof" : ""}</div>
        </div>
      </div>

      <div className="j-affliction">
        <div className="text-[10px] uppercase tracking-widest mb-1 opacity-70">Affliction</div>
        {readOnly ? (
          <div>{character.affliction_note || <span className="opacity-60">no curse weighs upon you</span>}</div>
        ) : (
          <textarea
            className="bg-transparent w-full outline-none resize-none italic"
            rows={2}
            value={character.affliction_note}
            placeholder="Cursed by the Tower of Crescent Moon…"
            onChange={(e) => setField("affliction_note", e.target.value)}
          />
        )}
      </div>
    </div>
  );
}
