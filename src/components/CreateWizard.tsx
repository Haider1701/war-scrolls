import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { abilityMod, fmtMod } from "@/lib/types";
import { Embers } from "./Embers";

const db = supabase as any;

export function CreateWizard({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [race, setRace] = useState("");
  const [alignment, setAlignment] = useState("");
  const [background, setBackground] = useState("");
  const [scores, setScores] = useState({ strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function onFile(f: File | null) {
    if (!f) return;
    setImageFile(f);
    const r = new FileReader();
    r.onload = () => setImagePreview(r.result as string);
    r.readAsDataURL(f);
  }

  async function save() {
    setSaving(true); setErr("");
    try {
      let image_url = "";
      const { data: ch, error: e1 } = await db.from("characters").insert({
        user_id: userId, name, subtitle, class_level: classLevel,
        race, alignment, background,
        proficiency_bonus: 2, passive_perception: 10 + abilityMod(scores.wisdom),
      }).select().single();
      if (e1) throw e1;

      if (imageFile) {
        const path = `${userId}/${ch.id}/${Date.now()}_${imageFile.name}`;
        const { error: ue } = await supabase.storage.from("character-portraits").upload(path, imageFile, { upsert: true });
        if (!ue) {
          const { data: signed } = await supabase.storage.from("character-portraits").createSignedUrl(path, 60 * 60 * 24 * 365);
          image_url = signed?.signedUrl ?? "";
          await db.from("characters").update({ image_url }).eq("id", ch.id);
        }
      }

      await db.from("ability_scores").insert({ character_id: ch.id, ...scores });
      await db.from("spell_meta").insert({ character_id: ch.id });
      await db.from("currency").insert({ character_id: ch.id });
      await db.from("traits").insert({ character_id: ch.id });
      await db.from("free_notes").insert({ character_id: ch.id });

      onDone();
    } catch (e: any) { setErr(e.message ?? "Failed to forge character"); }
    finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <Embers />
      <div className="j-page p-10 w-full max-w-2xl relative">
        <div className="j-spine" />
        <div className="pl-6">
          <h1 className="j-h text-3xl text-center">Forge Your Codex</h1>
          <p className="text-center text-[var(--color-muted)] italic mb-4">Step {step} of 4</p>
          <div className="j-divider-ornate">✦</div>

          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name" v={name} set={setName} />
              <Field label="Subtitle" v={subtitle} set={setSubtitle} placeholder="Knight of the Wasting Light" />
              <Field label="Class & Level" v={classLevel} set={setClassLevel} placeholder="War Cleric 1" />
              <Field label="Race" v={race} set={setRace} placeholder="Human (Variant)" />
              <Field label="Alignment" v={alignment} set={setAlignment} placeholder="Lawful Good" />
              <Field label="Background" v={background} set={setBackground} placeholder="Noble" />
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-3 gap-4">
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

          {step === 3 && (
            <div>
              <label className="block">
                <div className="j-card cursor-pointer text-center py-10 border-dashed">
                  {imagePreview ? (
                    <img src={imagePreview} alt="" className="max-h-64 mx-auto rounded" />
                  ) : (
                    <div>
                      <div className="text-5xl mb-2">🖼️</div>
                      <div className="text-[var(--color-muted)]">Click to choose a portrait</div>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
                </div>
              </label>
              <p className="text-center text-xs text-[var(--color-muted)] mt-3 italic">Optional — you can add or change this later.</p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-2">
              <p><span className="text-[var(--color-muted)]">Name:</span> <span className="j-glow-text">{name || "—"}</span></p>
              <p><span className="text-[var(--color-muted)]">Class:</span> {classLevel || "—"}</p>
              <p><span className="text-[var(--color-muted)]">Race:</span> {race || "—"}</p>
              <p><span className="text-[var(--color-muted)]">Alignment:</span> {alignment || "—"}</p>
              <p><span className="text-[var(--color-muted)]">Background:</span> {background || "—"}</p>
              <p><span className="text-[var(--color-muted)]">Scores:</span> STR {scores.strength} · DEX {scores.dexterity} · CON {scores.constitution} · INT {scores.intelligence} · WIS {scores.wisdom} · CHA {scores.charisma}</p>
            </div>
          )}

          {err && <div className="j-affliction mt-4 text-sm">{err}</div>}

          <div className="flex justify-between mt-8">
            <button className="j-btn j-btn-ghost" disabled={step === 1} onClick={() => setStep(step - 1)}>← Back</button>
            {step < 4 ? (
              <button className="j-btn" disabled={step === 1 && !name} onClick={() => setStep(step + 1)}>Next →</button>
            ) : (
              <button className="j-btn" disabled={saving || !name} onClick={save}>{saving ? "Forging..." : "Bind in Fire"}</button>
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
