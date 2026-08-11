import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { abilityMod, fmtMod, MAX_IMAGES, MAX_NPCS, MAX_PLAYERS, type CharacterType } from "@/lib/types";
import { Embers } from "./Embers";

const db = supabase as any;

type PendingImage = { file: File; preview: string };

export function CreateWizard({
  userId, initialType, onDone, onCancel,
}: {
  userId: string;
  initialType?: CharacterType | null;
  onDone: (newId?: string) => void;
  onCancel?: () => void;
}) {
  const [type, setType] = useState<CharacterType | null>(initialType ?? null);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [classLevel2, setClassLevel2] = useState("");
  const [race, setRace] = useState("");
  const [alignment, setAlignment] = useState("");
  const [background, setBackground] = useState("");
  const [scores, setScores] = useState({ strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 });
  const [images, setImages] = useState<PendingImage[]>([]);
  const [backstory, setBackstory] = useState("");
  const [aiGen, setAiGen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [primaryIdx, setPrimaryIdx] = useState(0);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function addFiles(fl: FileList | null) {
    if (!fl) return;
    const remaining = MAX_IMAGES - images.length;
    const list = Array.from(fl).slice(0, remaining);
    const promises = list.map(
      (file) => new Promise<PendingImage>((res) => {
        const r = new FileReader();
        r.onload = () => res({ file, preview: r.result as string });
        r.readAsDataURL(file);
      }),
    );
    Promise.all(promises).then((arr) => setImages((prev) => [...prev, ...arr]));
  }
  function removeImage(i: number) {
    setImages((prev) => prev.filter((_, j) => j !== i));
    if (primaryIdx >= images.length - 1) setPrimaryIdx(0);
  }

  // NPC has fewer steps: 1=basics, 2=portraits, 3=review
  const isNpc = type === "npc";
  const lastStep = isNpc ? 3 : 5;


  async function save() {
    if (!type) return;
    setSaving(true); setErr("");
    try {
      // Enforce limits
      const { count } = await db.from("characters").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("character_type", type);
      const limit = type === "player" ? MAX_PLAYERS : MAX_NPCS;
      if ((count ?? 0) >= limit) {
        setErr(`You already have ${limit} ${type === "player" ? "player characters" : "NPCs"}. Delete one to create a new one.`);
        setSaving(false);
        return;
      }

      const { data: ch, error: e1 } = await db.from("characters").insert({
        user_id: userId, character_type: type, name, subtitle,
        class_level: isNpc ? "" : classLevel,
        class_level_2: isNpc ? null : (classLevel2.trim() || null),
        race, alignment, background: isNpc ? "" : background,
        backstory: isNpc ? "" : backstory,
        ai_generated: isNpc ? false : aiGen,
        proficiency_bonus: 2,
        passive_perception: 10 + abilityMod(scores.wisdom),
      }).select().single();

      if (e1) throw e1;

      // Upload images
      let primaryUrl = "";
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const path = `${userId}/${ch.id}/images/${Date.now()}_${i}_${img.file.name}`;
        const { error: ue } = await supabase.storage.from("character-portraits").upload(path, img.file, { upsert: true });
        if (ue) continue;
        const { data: signed } = await supabase.storage.from("character-portraits").createSignedUrl(path, 60 * 60 * 24 * 365);
        const url = signed?.signedUrl ?? "";
        if (!url) continue;
        const isPrim = i === primaryIdx;
        await db.from("character_images").insert({
          character_id: ch.id, image_url: url, is_primary: isPrim, sort_order: i,
        });
        if (isPrim) primaryUrl = url;
      }
      if (primaryUrl) {
        await db.from("characters").update({ image_url: primaryUrl }).eq("id", ch.id);
      }

      await db.from("ability_scores").insert({ character_id: ch.id, ...scores });
      if (!isNpc) {
        await db.from("spell_meta").insert({ character_id: ch.id });
        await db.from("currency").insert({ character_id: ch.id });
        await db.from("traits").insert({ character_id: ch.id });
        await db.from("free_notes").insert({ character_id: ch.id });
      }

      onDone(ch.id);
    } catch (e: any) { setErr(e.message ?? "Failed to forge character"); }
    finally { setSaving(false); }
  }

  // Step 0: pick type
  if (!type) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative">
        <Embers />
        <div className="j-page p-8 md:p-10 w-full max-w-2xl relative">
          <div className="j-spine" />
          <div className="pl-6">
            <div className="flex items-center mb-4">
              {onCancel && <button className="j-btn j-btn-ghost" onClick={onCancel}>← Back</button>}
              <div className="flex-1" />
            </div>
            <h1 className="j-h text-3xl text-center mb-2">What shall be forged?</h1>
            <p className="text-center text-[var(--color-muted)] italic mb-6">Choose the kind of soul you are binding into the codex.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <button className="j-card text-left hover:shadow-[0_0_24px_-4px_var(--color-ember)] hover:border-[var(--color-ember)] transition group p-6"
                onClick={() => setType("player")}>
                <div className="text-5xl mb-3">⚔️</div>
                <div className="j-h text-2xl mb-1">Player Character</div>
                <p className="text-sm text-[var(--color-muted)]">Full journal — stats, spells, sessions, gear, and notes. Up to {MAX_PLAYERS}.</p>
              </button>
              <button className="j-card text-left hover:shadow-[0_0_24px_-4px_var(--color-ember)] hover:border-[var(--color-ember)] transition group p-6"
                onClick={() => setType("npc")}>
                <div className="text-5xl mb-3">🎭</div>
                <div className="j-h text-2xl mb-1">NPC</div>
                <p className="text-sm text-[var(--color-muted)]">A single page — bio, disposition, key stats, and roleplay notes. Up to {MAX_NPCS}.</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <Embers />
      <div className="j-page p-6 md:p-10 w-full max-w-2xl relative">
        <div className="j-spine" />
        <div className="pl-6">
          <div className="flex items-center mb-2 gap-2">
            <button className="j-btn j-btn-ghost" onClick={() => { if (step === 1) { setType(null); } else setStep(step - 1); }}>← Back</button>
            <div className="flex-1" />
            <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border border-[var(--color-muted)] text-[var(--color-muted)]">
              {isNpc ? "NPC" : "Player"}
            </span>
          </div>
          <h1 className="j-h text-3xl text-center">Forge Your {isNpc ? "NPC" : "Codex"}</h1>
          <p className="text-center text-[var(--color-muted)] italic mb-4">Step {step} of {lastStep}</p>
          <div className="j-divider-ornate">✦</div>

          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name" v={name} set={setName} />
              <Field label={isNpc ? "Role / Title" : "Subtitle"} v={subtitle} set={setSubtitle}
                placeholder={isNpc ? "Tavernkeeper of Wyrmpost" : "Knight of the Wasting Light"} />
              {!isNpc && (
                <>
                  <Field label="Class & Level" v={classLevel} set={setClassLevel} placeholder="War Cleric 1" />
                  <Field label="Second Class & Level (optional, for multiclass)" v={classLevel2} set={setClassLevel2} placeholder="Fighter 2" />
                </>
              )}
              <Field label="Race" v={race} set={setRace} placeholder="Human (Variant)" />
              <Field label="Alignment" v={alignment} set={setAlignment} placeholder="Lawful Good" />
              {!isNpc && <Field label="Background" v={background} set={setBackground} placeholder="Noble" />}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-3 gap-3">
              {(["strength","dexterity","constitution","intelligence","wisdom","charisma"] as const).map((k) => (
                <div key={k} className="j-card text-center">
                  <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">{k.slice(0,3)}</div>
                  <input type="number" className="j-num text-2xl my-2" value={scores[k]}
                    onChange={(e) => setScores({ ...scores, [k]: parseInt(e.target.value) || 0 })} />
                  <div className="j-glow-text text-lg">{fmtMod(abilityMod(scores[k]))}</div>
                </div>
              ))}
            </div>
          )}

          {((isNpc && step === 2) || (!isNpc && step === 3)) && false /* unreachable */}

          {((isNpc && step === 2) || (!isNpc && step === 3)) && (
            <div /> /* placeholder to keep layout symmetry — actual portrait below */
          )}

          {/* Portrait step: NPC step 2, Player step 3 */}
          {((isNpc && step === 2) || (!isNpc && step === 3)) && (
            <div className="space-y-3">
              <div className="text-xs text-[var(--color-muted)] italic">
                Upload up to {MAX_IMAGES} images. The first is the cover portrait — click ★ to change.
              </div>
              <label className="block">
                <div className="j-card cursor-pointer text-center py-8 border-dashed hover:border-[var(--color-ember)] hover:shadow-[0_0_18px_-6px_var(--color-ember)] transition">
                  <div className="text-4xl mb-2">🖼️</div>
                  <div className="text-[var(--color-muted)]">Click or choose images ({images.length}/{MAX_IMAGES})</div>
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => addFiles(e.target.files)} />
                </div>
              </label>
              {images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative group aspect-square rounded overflow-hidden border border-[rgba(255,106,0,0.25)]">
                      <img src={img.preview} alt="" className="w-full h-full object-cover" />
                      {primaryIdx === i && (
                        <div className="absolute top-1 left-1 text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--color-ember)] text-black font-bold">★ Cover</div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 p-1 flex gap-1 opacity-0 group-hover:opacity-100 transition bg-gradient-to-t from-black/80 to-transparent">
                        {primaryIdx !== i && (
                          <button className="text-[10px] j-btn j-btn-ghost !py-0.5 !px-2 flex-1" onClick={() => setPrimaryIdx(i)}>Make Cover</button>
                        )}
                        <button className="text-[10px] text-[var(--color-blood)] px-2 hover:text-white" onClick={() => removeImage(i)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Backstory step (player characters only) */}
          {!isNpc && step === 4 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="j-h text-lg">Backstory</h3>
                {aiGen && (
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-[var(--color-ember)] text-[var(--color-ember)]">
                    ✨ AI Generated
                  </span>
                )}
                <div className="flex-1" />
                <button className="j-btn" onClick={() => setGenOpen(true)}>✨ Generate with AI</button>
              </div>
              <textarea
                className="j-textarea text-justify"
                rows={9}
                style={{ textIndent: "2em" }}
                value={backstory}
                onChange={(e) => { setBackstory(e.target.value); }}
                placeholder="Write your tale, or let the embers write it for you…"
              />
              <p className="text-xs text-[var(--color-muted)] italic">Optional — you can always write this later.</p>
              {genOpen && (
                <BackstoryGeneratorModal
                  race={race}
                  klass={[classLevel, classLevel2].filter(Boolean).join(" / ")}
                  alignment={alignment}
                  hasExisting={Boolean(backstory.trim())}
                  onClose={() => setGenOpen(false)}
                  onKeep={(t) => { setBackstory(t); setAiGen(true); setGenOpen(false); }}
                />
              )}
            </div>
          )}


          {/* Review step */}
          {step === lastStep && (
            <div className="space-y-1 text-sm">
              <p><span className="text-[var(--color-muted)]">Type:</span> {isNpc ? "NPC" : "Player Character"}</p>
              <p><span className="text-[var(--color-muted)]">Name:</span> <span className="j-glow-text">{name || "—"}</span></p>
              {!isNpc && <p><span className="text-[var(--color-muted)]">Class:</span> {[classLevel, classLevel2].filter(Boolean).join(" / ") || "—"}</p>}
              <p><span className="text-[var(--color-muted)]">Race:</span> {race || "—"}</p>
              <p><span className="text-[var(--color-muted)]">Alignment:</span> {alignment || "—"}</p>
              {!isNpc && <p><span className="text-[var(--color-muted)]">Background:</span> {background || "—"}</p>}
              <p><span className="text-[var(--color-muted)]">Images:</span> {images.length}</p>
              <p><span className="text-[var(--color-muted)]">Scores:</span> STR {scores.strength} · DEX {scores.dexterity} · CON {scores.constitution} · INT {scores.intelligence} · WIS {scores.wisdom} · CHA {scores.charisma}</p>
            </div>
          )}

          {err && <div className="j-affliction mt-4 text-sm">{err}</div>}

          <div className="flex justify-between mt-8">
            <button className="j-btn j-btn-ghost" disabled={step === 1} onClick={() => setStep(step - 1)}>← Back</button>
            {step < lastStep ? (
              <button className="j-btn" disabled={step === 1 && !name} onClick={() => setStep(step + 1)}>Next →</button>
            ) : (
              <button className="j-btn" disabled={saving || !name} onClick={save}>
                {saving ? <span className="inline-flex items-center gap-2"><span className="j-spinner" /> Forging…</span> : "Create Character"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, v, set, placeholder }: { label: string; v: string; set: (s: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-[var(--color-muted)] block mb-1">{label}</span>
      <input className="j-input" value={v} onChange={(e) => set(e.target.value)} placeholder={placeholder} maxLength={120} />
    </label>
  );
}
