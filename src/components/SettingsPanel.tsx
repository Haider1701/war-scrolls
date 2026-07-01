import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { THEMES, useTheme } from "./ThemeProvider";

const db = supabase as any;

export function SettingsPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { theme, setTheme } = useTheme();
  const [isGm, setIsGm] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await db.from("user_preferences").select("is_gm").eq("user_id", userId).maybeSingle();
      setIsGm(!!data?.is_gm);
    })();
  }, [userId]);

  async function toggleGm() {
    const next = !isGm;
    setIsGm(next);
    await db.from("user_preferences").upsert({ user_id: userId, is_gm: next }, { onConflict: "user_id" });
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4 j-fade" onClick={onClose}>
      <div className="j-page p-8 max-w-lg w-full relative" onClick={(e) => e.stopPropagation()}>
        <div className="j-spine" />
        <button className="absolute top-2 right-3 text-2xl text-[var(--color-muted)] hover:text-[var(--color-flame)]" onClick={onClose}>×</button>
        <div className="pl-4">
          <h2 className="j-h text-2xl mb-4">⚙ Settings</h2>

          <div className="mb-6">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-2">Theme</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => setTheme(t.id)}
                  className={`j-card text-left transition ${theme === t.id ? "ring-2 ring-[var(--color-ember)]" : "opacity-80 hover:opacity-100"}`}>
                  <div className="flex gap-1 mb-2">
                    {t.swatches.map((c) => (
                      <span key={c} className="w-6 h-6 rounded-full border border-black/40" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="j-glow-text text-sm" style={{ fontFamily: "var(--font-uncial)" }}>{t.name}</div>
                  <div className="text-xs text-[var(--color-muted)] italic">{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="j-card flex items-center justify-between">
            <div>
              <div className="j-glow-text" style={{ fontFamily: "var(--font-uncial)" }}>🎲 Game Master mode</div>
              <div className="text-xs text-[var(--color-muted)] italic">Receive homebrew spell approval requests.</div>
            </div>
            <button onClick={toggleGm} className={`j-btn ${isGm ? "" : "j-btn-ghost"}`}>
              {isGm ? "On" : "Off"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
