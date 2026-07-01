import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ThemeId = "ember" | "frost" | "tome";

export const THEMES: { id: ThemeId; name: string; swatches: string[]; description: string }[] = [
  { id: "ember", name: "Fire & Ember",  swatches: ["#100b03", "#ff6a00", "#ffb830", "#c43030"], description: "Dark forge, glowing embers." },
  { id: "frost", name: "Arcane Frost",  swatches: ["#050d1a", "#0a1628", "#4dd9ff", "#c8f0ff"], description: "Icy magic under a midnight sky." },
  { id: "tome",  name: "Ancient Tome",  swatches: ["#2a1f0e", "#c8960a", "#3a6b35", "#2d1a06"], description: "Sepia parchment, aged ink." },
];

const Ctx = createContext<{ theme: ThemeId; setTheme: (t: ThemeId) => void }>({
  theme: "ember",
  setTheme: () => {},
});
export const useTheme = () => useContext(Ctx);

const LS = "ember-codex.theme";
const db = supabase as any;

export function ThemeProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return "ember";
    return (window.localStorage.getItem(LS) as ThemeId) || "ember";
  });

  // Apply to <html data-theme>
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Load from DB when user logs in
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await db.from("user_preferences").select("theme").eq("user_id", userId).maybeSingle();
      if (data?.theme) {
        setThemeState(data.theme as ThemeId);
        window.localStorage.setItem(LS, data.theme);
      }
    })();
  }, [userId]);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    if (typeof window !== "undefined") window.localStorage.setItem(LS, t);
    if (userId) db.from("user_preferences").upsert({ user_id: userId, theme: t }, { onConflict: "user_id" }).then(() => {});
  }, [userId]);

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}
