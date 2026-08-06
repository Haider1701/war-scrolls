import { useRef, useState } from "react";
import type { Character } from "@/lib/types";
import { importCharacterPdf, type ImportReport } from "@/lib/pdfImport";

export function PdfImportPanel({
  character, onImported, onClose,
}: { character: Character; onImported: () => void; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true); setError(null); setReport(null);
    try {
      const r = await importCharacterPdf(file, character);
      setReport(r);
      onImported();
    } catch (e: any) {
      setError(e?.message || "That PDF could not be read.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cdx-modal" role="dialog" aria-label="Import character sheet PDF">
      <div className="cdx-modal-body">
        <h3 className="cdx-title text-2xl">Import a Character Sheet</h3>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          Drop in an official D&amp;D 5e character sheet PDF (fillable sheets work best). Its contents are
          read in your browser and bound into this codex.
        </p>

        <div
          className="cdx-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Deciphering the parchment…" : "Click or drop a PDF here"}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        {error && <p className="cdx-affliction mt-3">{error}</p>}

        {report && (
          <div className="mt-4 text-sm">
            <p className="cdx-stat-label">
              {report.fieldsFound} fields read ({report.mode === "form" ? "fillable sheet" : "text scan"})
            </p>
            <div className="grid gap-3 md:grid-cols-2 mt-2">
              <div>
                <div className="cdx-panel-title">Imported</div>
                <ul className="cdx-tags">{report.applied.map((a) => <li key={a}>{a}</li>)}</ul>
              </div>
              <div>
                <div className="cdx-panel-title">Not found in PDF</div>
                {report.missing.length === 0
                  ? <p className="cdx-empty">Nothing missing.</p>
                  : <ul className="cdx-tags cdx-tags-muted">{report.missing.map((a) => <li key={a}>{a}</li>)}</ul>}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button className="j-btn j-btn-ghost" onClick={onClose}>{report ? "Done" : "Cancel"}</button>
        </div>
      </div>
    </div>
  );
}
