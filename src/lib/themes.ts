export type ThemeId = "ember" | "frost" | "tome" | "shadow" | "druid" | "custom";

export type FontPair = { id: string; heading: string; body: string; label: string };

export const FONT_PAIRS: FontPair[] = [
  { id: "uncial-fell",      heading: "Uncial Antiqua",       body: "IM Fell English", label: "Uncial · IM Fell" },
  { id: "cinzel-raleway",   heading: "Cinzel Decorative",    body: "Raleway",         label: "Cinzel Decorative · Raleway" },
  { id: "fraktur-lora",     heading: "UnifrakturMaguntia",   body: "Lora",            label: "UnifrakturMaguntia · Lora" },
  { id: "cinzel-crimson",   heading: "Cinzel",               body: "Crimson Text",    label: "Cinzel · Crimson Text" },
  { id: "philosopher-merri",heading: "Philosopher",          body: "Merriweather",    label: "Philosopher · Merriweather" },
  { id: "playfair-lato",    heading: "Playfair Display",     body: "Lato",            label: "Playfair · Lato" },
  { id: "cormorant-nunito", heading: "Cormorant Garamond",   body: "Nunito",          label: "Cormorant · Nunito" },
  { id: "ebgaramond-inter", heading: "EB Garamond",          body: "Inter",           label: "EB Garamond · Inter" },
];

export type CustomTheme = {
  name?: string;
  fontPairId?: string;
  colors: {
    coal: string;
    page: string;
    page2?: string;
    ember: string;
    ember2?: string;
    flame: string;
    flame2?: string;
    ink: string;
    muted: string;
    blood: string;
    border?: string;
  };
};

export type ThemePreset = {
  id: ThemeId;
  name: string;
  description: string;
  swatches: string[];
  fontPairId: string;
};

export const THEMES: ThemePreset[] = [
  { id: "ember",  name: "Fire & Ember",  swatches: ["#100b03","#ff6a00","#ffb830","#c43030"], description: "Dark forge, glowing embers.",   fontPairId: "uncial-fell" },
  { id: "frost",  name: "Arcane Frost",  swatches: ["#050d1a","#0a1628","#4dd9ff","#c8f0ff"], description: "Icy magic under midnight.",     fontPairId: "cinzel-raleway" },
  { id: "tome",   name: "Ancient Tome",  swatches: ["#2a1f0e","#c8960a","#3a6b35","#2d1a06"], description: "Sepia parchment, aged ink.",    fontPairId: "fraktur-lora" },
  { id: "shadow", name: "Shadow Rogue",  swatches: ["#0a0010","#9b30ff","#c87dff","#e8d5ff"], description: "Dark purple assassin's mark.",  fontPairId: "cinzel-crimson" },
  { id: "druid",  name: "Nature Druid",  swatches: ["#070f05","#4caf50","#a5d6a7","#dcedc8"], description: "Forest breath, moss and moon.", fontPairId: "philosopher-merri" },
];

export const DEFAULT_CUSTOM: CustomTheme = {
  name: "My Custom Theme",
  fontPairId: "uncial-fell",
  colors: {
    coal: "#100b03",
    page: "#1b1205",
    page2: "#241808",
    ember: "#ff6a00",
    ember2: "#ff8a2c",
    flame: "#ffb830",
    flame2: "#ffd060",
    ink: "#f0d8a8",
    muted: "#7a5a30",
    blood: "#c43030",
    border: "#ff6a00",
  },
};

export function fontPair(id?: string | null): FontPair {
  return FONT_PAIRS.find((f) => f.id === id) ?? FONT_PAIRS[0];
}
