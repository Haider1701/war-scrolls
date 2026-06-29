import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Character } from "@/lib/types";
import { useToast } from "../Toast";

const db = supabase as any;

const DETAILS: { key: keyof Character; label: string }[] = [
  { key: "class_level", label: "Class & Level" },
  { key: "race", label: "Race" },
  { key: "alignment", label: "Alignment" },
  { key: "background", label: "Background" },
  { key: "proficiency_bonus", label: "Proficiency" },
  { key: "passive_perception", label: "Passive Perception" },
];

export function CoverTab({ character, onChange, readOnly }: {
  character: Character; onChange: (c: Character) => void; readOnly: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const toast = useToast();

  async function upload(file: File) {
    const path = `${character.user_id}/${character.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("character-portraits").upload(path, file, { upsert: true });
    if (error) { toast("Upload failed"); return; }
    const { data: signed } = await supabase.storage.from("character-portraits").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl ?? "";
    await db.from("characters").update({ image_url: url }).eq("id", character.id);
    onChange({ ...character, image_url: url });
    toast("Portrait bound");
  }

  function setField<K extends keyof Character>(k: K, v: Character[K]) {
    onChange({ ...character, [k]: v });
  }

  return (
    <div className="j-fade">
      <div
        className={`j-card j-vignette relative overflow-hidden mb-6 ${!readOnly ? "cursor-pointer" : ""}`}
        onDragOver={(e) => { if (!readOnly) { e.preventDefault(); setDragging(true); } }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (readOnly) return;
          e.preventDefault(); setDragging(false);
          const f = e.dataTransfer.files?.[0]; if (f) upload(f);
        }}
        onClick={() => !readOnly && fileRef.current?.click()}
        style={{ minHeight: 260 }}
      >
        {character.image_url ? (
          <img src={character.image_url} alt={character.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--color-muted)] italic">
            {readOnly ? "No portrait yet" : (dragging ? "Release to bind portrait" : "Click or drop an image to bind the portrait")}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
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
        {DETAILS.map((d) => (
          <div key={d.key} className="j-card">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">{d.label}</div>
            {readOnly ? (
              <div className="j-glow-text" style={{ fontFamily: "var(--font-uncial)", fontSize: "1.05rem" }}>
                {String(character[d.key] ?? "") || <span className="text-[var(--color-muted)] italic">unset</span>}
              </div>
            ) : (
              <input
                className="j-input"
                value={String(character[d.key] ?? "")}
                onChange={(e) => {
                  const raw = e.target.value;
                  const next = (d.key === "proficiency_bonus" || d.key === "passive_perception")
                    ? (parseInt(raw) || 0) as any
                    : raw;
                  setField(d.key, next as any);
                }}
              />
            )}
          </div>
        ))}
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
