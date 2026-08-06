import { useCallback, useEffect, useMemo, useState } from "react";
import type { Character } from "@/lib/types";
import { loadCodexData, type CodexData } from "@/lib/codexData";
import { exportCharacterPdf } from "@/lib/pdf/exportCharacterPdf";
import { PdfImportPanel } from "./PdfImportPanel";
import {
  CombatPage, CoverPage, FeaturesPage, GalleryPage, InventoryPage,
  OverviewPage, PortraitPage, SpellbookPage, StoryPage,
} from "./pages";

const CHAPTERS: { id: string; label: string; render: (d: CodexData) => JSX.Element }[] = [
  { id: "cover", label: "Title Page", render: (d) => <CoverPage d={d} /> },
  { id: "portrait", label: "Portrait", render: (d) => <PortraitPage d={d} /> },
  { id: "overview", label: "Overview", render: (d) => <OverviewPage d={d} /> },
  { id: "combat", label: "Combat", render: (d) => <CombatPage d={d} /> },
  { id: "inventory", label: "Inventory", render: (d) => <InventoryPage d={d} /> },
  { id: "features", label: "Features", render: (d) => <FeaturesPage d={d} /> },
  { id: "spells", label: "Spellbook", render: (d) => <SpellbookPage d={d} /> },
  { id: "story", label: "Story", render: (d) => <StoryPage d={d} /> },
  { id: "gallery", label: "Gallery", render: (d) => <GalleryPage d={d} /> },
];

export function Codex({ character, onClose }: { character: Character; onClose: () => void }) {
  const [data, setData] = useState<CodexData | null>(null);
  const [idx, setIdx] = useState(0);
  const [flip, setFlip] = useState<"next" | "prev" | null>(null);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const reload = useCallback(async () => {
    const d = await loadCodexData(character);
    setData(d);
  }, [character]);

  useEffect(() => { reload(); }, [reload]);

  const turn = useCallback((delta: number) => {
    setIdx((cur) => {
      const next = Math.max(0, Math.min(CHAPTERS.length - 1, cur + delta));
      if (next === cur) return cur;
      setPrevIdx(cur);
      setFlip(delta > 0 ? "next" : "prev");
      window.setTimeout(() => { setFlip(null); setPrevIdx(null); }, 760);
      return next;
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") turn(1);
      else if (e.key === "ArrowLeft") turn(-1);
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn, onClose]);

  const chapter = CHAPTERS[idx];
  const content = useMemo(() => (data ? chapter.render(data) : null), [data, chapter]);
  const prevContent = useMemo(
    () => (data && prevIdx !== null ? CHAPTERS[prevIdx].render(data) : null),
    [data, prevIdx],
  );

  async function doExport() {
    setExporting(true);
    try { await exportCharacterPdf(character); } finally { setExporting(false); }
  }

  return (
    <div className="cdx-root">
      <div className="cdx-bar">
        <button className="j-btn j-btn-ghost" onClick={onClose}>‹ Close Codex</button>
        <nav className="cdx-chapters" aria-label="Chapters">
          {CHAPTERS.map((c, i) => (
            <button
              key={c.id}
              className={`cdx-chapter-link ${i === idx ? "active" : ""}`}
              aria-current={i === idx ? "page" : undefined}
              onClick={() => turn(i - idx)}
            >
              {c.label}
            </button>
          ))}
        </nav>
        <div className="flex gap-2 shrink-0">
          <button className="j-btn" onClick={() => setImporting(true)}>Import PDF</button>
          <button className="j-btn j-btn-ghost" onClick={doExport} disabled={exporting}>
            {exporting ? "Binding…" : "Export PDF"}
          </button>
        </div>
      </div>

      <div className="cdx-stage">
        <div className={`cdx-book ${chapter.id === "cover" ? "cdx-book-cover" : ""}`}>
          <div className="cdx-page">
            <div className="cdx-page-inner">
              {data ? content : <p className="cdx-empty">Unbinding the codex…</p>}
            </div>
            <span className="cdx-folio">{idx + 1} / {CHAPTERS.length}</span>
          </div>

          {flip && prevContent && (
            <div className={`cdx-flip cdx-flip-${flip}`} aria-hidden>
              <div className="cdx-page">
                <div className="cdx-page-inner">{prevContent}</div>
                <span className="cdx-flip-shade" />
              </div>
            </div>
          )}
        </div>

        <button className="cdx-arrow cdx-arrow-l" onClick={() => turn(-1)} disabled={idx === 0} aria-label="Previous page">‹</button>
        <button className="cdx-arrow cdx-arrow-r" onClick={() => turn(1)} disabled={idx === CHAPTERS.length - 1} aria-label="Next page">›</button>
      </div>

      {importing && (
        <PdfImportPanel
          character={character}
          onImported={reload}
          onClose={() => setImporting(false)}
        />
      )}
    </div>
  );
}
