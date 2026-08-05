import type { CustomTheme, ThemeId } from "../themes";

export type PdfPalette = {
  bg: string;
  panel: string;
  border: string;
  accent: string;
  accent2: string;
  ink: string;
  muted: string;
  blood: string;
};

const PRESETS: Record<Exclude<ThemeId, "custom">, PdfPalette> = {
  ember:  { bg: "#100b03", panel: "#1b1205", border: "#ff6a00", accent: "#ff6a00", accent2: "#ffb830", ink: "#f0d8a8", muted: "#a8834c", blood: "#c43030" },
  frost:  { bg: "#050d1a", panel: "#0a1628", border: "#4dd9ff", accent: "#4dd9ff", accent2: "#c8f0ff", ink: "#dff4ff", muted: "#7ba7bf", blood: "#4d8fff" },
  tome:   { bg: "#f2e4c4", panel: "#e8d6ac", border: "#8a6a24", accent: "#8a5a10", accent2: "#3a6b35", ink: "#2d1a06", muted: "#6b5330", blood: "#8c2b1e" },
  shadow: { bg: "#0a0010", panel: "#150a1f", border: "#9b30ff", accent: "#9b30ff", accent2: "#c87dff", ink: "#e8d5ff", muted: "#9a7ab0", blood: "#ff3b7f" },
  druid:  { bg: "#070f05", panel: "#0e1a0b", border: "#4caf50", accent: "#4caf50", accent2: "#a5d6a7", ink: "#dcedc8", muted: "#88a878", blood: "#b5651d" },
};

export function pdfPalette(theme?: ThemeId | null, custom?: CustomTheme | null): PdfPalette {
  if (theme === "custom" && custom?.colors) {
    const c = custom.colors;
    return {
      bg: c.coal,
      panel: c.page,
      border: c.border ?? c.ember,
      accent: c.ember,
      accent2: c.flame,
      ink: c.ink,
      muted: c.muted,
      blood: c.blood,
    };
  }
  return PRESETS[(theme as Exclude<ThemeId, "custom">) ?? "ember"] ?? PRESETS.ember;
}
