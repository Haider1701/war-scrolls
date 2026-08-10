import { useEffect, useRef, useState } from "react";
import type { Character } from "@/lib/types";
import { buildCharacterPdfBlob, pdfFileName } from "@/lib/pdf/exportCharacterPdf";

type Props = { character: Character; exportNote?: string; onClose: () => void };

/** Export options dialog: page-1 preview + full / main-only download. */
export function ExportPdfModal({ character, exportNote, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<"preview" | "idle" | "working">("preview");
  const [progress, setProgress] = useState("Rendering preview…");

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const blob = await buildCharacterPdfBlob(character, { exportNote });
        if (dead) return;
        const pdfjs: any = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        const page = await doc.getPage(1);
        const canvas = canvasRef.current;
        if (dead || !canvas) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 260 / base.width });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
      } catch {
        /* preview is best-effort */
      } finally {
        if (!dead) setStatus("idle");
      }
    })();
    return () => { dead = true; };
  }, [character, exportNote]);

  async function run(mainOnly: boolean) {
    setStatus("working");
    setProgress(mainOnly ? "Scribing main sheet…" : "Binding all four pages…");
    try {
      const blob = await buildCharacterPdfBlob(character, { exportNote, mainOnly });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfFileName(character);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      onClose();
    } finally {
      setStatus("idle");
    }
  }

  const busy = status !== "idle";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="j-page w-full max-w-lg rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="j-title text-xl">Export Journal</h3>
            <p className="j-muted text-xs">{pdfFileName(character)}</p>
          </div>
          <button className="j-btn j-btn-ghost" onClick={onClose} disabled={status === "working"}>Close</button>
        </div>

        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="rounded-xl border border-[var(--ember)]/40 bg-black/30 p-2">
            <canvas ref={canvasRef} className="rounded-lg" style={{ width: 260 }} />
          </div>
          {busy && <p className="j-muted animate-pulse text-xs">{progress}</p>}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button className="j-btn flex-1" onClick={() => run(false)} disabled={busy}>
            Export Full Sheet (4 pages)
          </button>
          <button className="j-btn j-btn-ghost flex-1" onClick={() => run(true)} disabled={busy}>
            Export Main Sheet Only (Page 1 + 3)
          </button>
        </div>
      </div>
    </div>
  );
}
