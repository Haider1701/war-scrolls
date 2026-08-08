import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { Character } from "@/lib/types";
import { THEMES, FONT_PAIRS, type ThemeId, type CustomTheme, fontPair } from "@/lib/themes";

export { THEMES, FONT_PAIRS, fontPair };
export type { ThemeId, CustomTheme };

type Ctx = {
  theme: ThemeId;
  customTheme: CustomTheme | null;
  activeCharacter: Character | null;
  saveTheme: (patch: { theme?: ThemeId; custom_theme?: CustomTheme | null }) => Promise<void>;
};

const ThemeCtx = createContext<Ctx>({
  theme: "ember",
  customTheme: null,
  activeCharacter: null,
  saveTheme: async () => {},
});
export const useTheme = () => useContext(ThemeCtx);

const CUSTOM_VAR_KEYS = [
  "--color-coal","--color-page","--color-page-2",
  "--color-ember","--color-ember-2","--color-flame","--color-flame-2",
  "--color-ink","--color-muted","--color-blood",
];

/** Applies a theme's CSS variables to an element (usually documentElement). */
export function applyThemeVars(el: HTMLElement, themeId: ThemeId, customTheme: CustomTheme | null) {
  el.setAttribute("data-theme", themeId);

  // Font pair
  const preset = THEMES.find((t) => t.id === themeId);
  const pairId = themeId === "custom" ? customTheme?.fontPairId : preset?.fontPairId;
  const pair = fontPair(pairId);
  el.style.setProperty("--font-uncial", `"${pair.heading}", serif`);
  el.style.setProperty("--font-fell", `"${pair.body}", serif`);

  // Custom colors
  if (themeId === "custom" && customTheme) {
    const c = customTheme.colors;
    el.style.setProperty("--color-coal", c.coal);
    el.style.setProperty("--color-page", c.page);
    el.style.setProperty("--color-page-2", c.page2 || c.page);
    el.style.setProperty("--color-ember", c.ember);
    el.style.setProperty("--color-ember-2", c.ember2 || c.ember);
    el.style.setProperty("--color-flame", c.flame);
    el.style.setProperty("--color-flame-2", c.flame2 || c.flame);
    el.style.setProperty("--color-ink", c.ink);
    el.style.setProperty("--color-muted", c.muted);
    el.style.setProperty("--color-blood", c.blood);
  } else {
    CUSTOM_VAR_KEYS.forEach((k) => el.style.removeProperty(k));
  }
}

export function ThemeProvider({
  character, onSaveCharacterTheme, children,
}: {
  character: Character | null;
  onSaveCharacterTheme: (patch: { theme?: ThemeId; custom_theme?: CustomTheme | null }) => Promise<void>;
  children: ReactNode;
}) {
  const themeId: ThemeId = ((character?.theme as ThemeId) || "ember");
  const customTheme = (character?.custom_theme as CustomTheme | null) ?? null;

  useEffect(() => {
    if (typeof document === "undefined") return;
    applyThemeVars(document.documentElement, themeId, customTheme);
  }, [themeId, customTheme]);


  return (
    <ThemeCtx.Provider value={{ theme: themeId, customTheme, activeCharacter: character, saveTheme: onSaveCharacterTheme }}>
      {children}
    </ThemeCtx.Provider>
  );
}
