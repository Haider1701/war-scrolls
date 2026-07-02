import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "./ThemeProvider";
import { DEFAULT_CUSTOM, FONT_PAIRS, type CustomTheme } from "@/lib/themes";

const db = supabase as any;

const FIELDS: { key: keyof CustomTheme["colors"]; label: string }[] = [
  { key: "coal",   label: "Background" },
  { key: "page",   label: "Page surface" },
  { key: "page2",  label: "Secondary surface" },
  { key: "ember",  label: "Primary accent" },
  { key: "flame",  label: "Secondary accent" },
  { key: "ink",    label: "Main text/ink" },
  { key: "muted",  label: "Muted text" },
  { key: "blood",  label: "Danger / HP" },
  { key: "border", label: "Border" },
];

export function CustomThemeBuilder({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { customTheme, saveTheme } = useTheme();
  const initial: CustomTheme = customTheme
    ? JSON.parse(JSON.stringify(customTheme))
    : JSON.parse(JSON.stringify(DEFAULT_CUSTOM));
  const [draft, setDraft] = useState<CustomTheme>(initial);
  const [saving, setSaving] = useState(false);

  // Live-preview: push draft to provider on any change
  function update(next: CustomTheme) {
    setDraft(next);
    // Live-apply without persisting to DB yet — provider effect runs when we save.
    // For instant preview, call saveTheme with the draft (writes DB too — acceptable).
    saveTheme({ theme: "custom", custom_theme: next });
  }

  function setColor(k: keyof CustomTheme["colors"], v: string) {
    update({ ...draft, colors: { ...draft.colors, [k]: v } });
  }
  function setFontPair(id: string) { update({ ...draft, fontPairId: id }); }
  function setName(v: string) { update({ ...draft, name: v }); }

  async function saveToLibrary() {
    setSaving(true);
    try {
      await db.from("user_custom_themes").insert({
        user_id: userId,
        name: draft.name || "My Custom Theme",
        theme: draft,
      });
    } finally { setSaving(false); }
  }

  function resetDefaults() {
    update(JSON.parse(JSON.stringify(DEFAULT_CUSTOM)));
  }

  return (
    <div className="j-card mt-3">
      <div className="flex items-center gap-2 mb-3">
        <input
          className="j-input flex-1"
          value={draft.name || ""}
          onChange={(e) => setName(e.target.value)}
          placeholder="Custom theme name"
        />
        <button className="j-btn j-btn-ghost" onClick={onClose}>Close</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex items-center gap-2 text-xs">
            <input
              type="color"
              value={(draft.colors as any)[f.key] || "#000000"}
              onChange={(e) => setColor(f.key, e.target.value)}
              className="w-8 h-8 rounded border border-[var(--color-muted)] bg-transparent cursor-pointer"
            />
            <span className="text-[var(--color-muted)]">{f.label}</span>
          </label>
        ))}
      </div>

      <label className="block mb-3">
        <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-1">Font pairing</div>
        <select
          className="j-input"
          value={draft.fontPairId || "uncial-fell"}
          onChange={(e) => setFontPair(e.target.value)}
        >
          {FONT_PAIRS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </label>

      <div className="flex gap-2 flex-wrap">
        <button className="j-btn" onClick={saveToLibrary} disabled={saving}>
          {saving ? "Saving…" : "💾 Save to My Themes"}
        </button>
        <button className="j-btn j-btn-ghost" onClick={resetDefaults}>Reset to Default</button>
      </div>

      <p className="text-[11px] italic text-[var(--color-muted)] mt-2">
        Changes apply live to this character. Save to your library to reuse across other characters.
      </p>
    </div>
  );
}
