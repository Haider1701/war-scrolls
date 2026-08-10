import { fontPair, THEMES, type CustomTheme, type ThemeId } from "../themes";

/** Maps a Google font family to a Fontsource CDN slug. */
const SLUG = (family: string) => family.toLowerCase().replace(/\s+/g, "-");

const CDN = (family: string, weight: 400 | 700) =>
  `https://cdn.jsdelivr.net/npm/@fontsource/${SLUG(family)}/files/${SLUG(family)}-latin-${weight}-normal.woff`;

export type PdfFonts = { heading: string; body: string };

const FALLBACK: PdfFonts = { heading: "Times-Bold", body: "Times-Roman" };
const registered = new Map<string, boolean>();

function headingBodyFamilies(theme?: ThemeId | null, custom?: CustomTheme | null) {
  const id =
    theme === "custom"
      ? custom?.fontPairId
      : THEMES.find((t) => t.id === (theme ?? "ember"))?.fontPairId;
  return fontPair(id);
}

/** Attempts to register the character's themed fonts; silently falls back to built-ins. */
export async function registerThemeFonts(
  theme?: ThemeId | null,
  custom?: CustomTheme | null,
): Promise<PdfFonts> {
  const pair = headingBodyFamilies(theme, custom);
  try {
    const { Font } = await import("@react-pdf/renderer");
    const out: PdfFonts = { ...FALLBACK };

    for (const [key, family] of [
      ["heading", pair.heading],
      ["body", pair.body],
    ] as const) {
      try {
        if (!registered.get(family)) {
          const sources = [{ src: CDN(family, 400), fontWeight: 400 as const }];
          const boldOk = await fetch(CDN(family, 700), { method: "HEAD" })
            .then((r) => r.ok)
            .catch(() => false);
          if (boldOk) sources.push({ src: CDN(family, 700), fontWeight: 700 as any });
          const regularOk = await fetch(sources[0].src, { method: "HEAD" })
            .then((r) => r.ok)
            .catch(() => false);
          if (!regularOk) throw new Error("font not available");
          Font.register({ family, fonts: sources as any });
          registered.set(family, true);
        }
        out[key] = family;
      } catch {
        /* keep fallback for this slot */
      }
    }
    return out;
  } catch {
    return FALLBACK;
  }
}

export const fallbackFonts = FALLBACK;
