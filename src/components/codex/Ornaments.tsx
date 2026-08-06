import type { ReactNode } from "react";

/** Ornate corner-framed parchment panel. */
export function Panel({
  title, children, className = "", accent = false,
}: { title?: string; children: ReactNode; className?: string; accent?: boolean }) {
  return (
    <section className={`cdx-panel ${accent ? "cdx-panel-accent" : ""} ${className}`}>
      {title ? <h3 className="cdx-panel-title">{title}</h3> : null}
      {children}
    </section>
  );
}

export function Rule({ label }: { label?: string }) {
  return (
    <div className="cdx-rule" role="presentation">
      <span className="cdx-rule-line" />
      <span className="cdx-rule-mark">{label ?? "❖"}</span>
      <span className="cdx-rule-line" />
    </div>
  );
}

export function Chapter({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="mb-6">
      <p className="cdx-eyebrow">{eyebrow}</p>
      <h2 className="cdx-title">{title}</h2>
      <Rule />
    </header>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="cdx-stat">
      <div className="cdx-stat-label">{label}</div>
      <div className="cdx-stat-value">{value ?? "—"}</div>
      {hint ? <div className="cdx-stat-hint">{hint}</div> : null}
    </div>
  );
}

export function Medallion({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="cdx-medallion">
      <span className="cdx-medallion-label">{label}</span>
      <span className="cdx-medallion-value">{value}</span>
      {sub ? <span className="cdx-medallion-sub">{sub}</span> : null}
    </div>
  );
}

export function Line({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="cdx-line">
      <span className="cdx-line-k">{k}</span>
      <span className="cdx-line-dots" />
      <span className="cdx-line-v">{v || "—"}</span>
    </div>
  );
}

export function Prose({ text, empty = "Not yet written." }: { text?: string | null; empty?: string }) {
  const t = (text ?? "").trim();
  if (!t) return <p className="cdx-empty">{empty}</p>;
  return (
    <div className="cdx-prose">
      {t.split(/\n{1,}/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

export function Emblem({ glyph }: { glyph: string }) {
  return (
    <div className="cdx-emblem" aria-hidden>
      <span>{glyph}</span>
    </div>
  );
}
