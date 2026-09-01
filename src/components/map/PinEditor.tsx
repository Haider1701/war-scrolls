import { useState } from "react";
import { PIN_META, type MapPin, type PinType } from "@/lib/mapTypes";

export type SessionOption = { id: string; label: string };

type Draft = {
  label: string;
  description: string;
  pin_type: PinType;
  session_id: string | null;
  is_visible_to_players: boolean;
};

export function PinEditor({
  pin, allowedTypes, sessions, canToggleVisibility, canEdit, canDelete, onSave, onDelete, onClose,
}: {
  pin: Partial<MapPin>;
  allowedTypes: PinType[];
  sessions: SessionOption[];
  canToggleVisibility?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onSave: (d: Draft) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [d, setD] = useState<Draft>({
    label: pin.label ?? "",
    description: pin.description ?? "",
    pin_type: (pin.pin_type as PinType) ?? allowedTypes[0],
    session_id: pin.session_id ?? null,
    is_visible_to_players: pin.is_visible_to_players ?? true,
  });
  const [busy, setBusy] = useState(false);
  const linkedSession = sessions.find((s) => s.id === d.session_id);

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-3 j-fade" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl p-4 space-y-3"
        style={{
          background: "linear-gradient(135deg, rgba(30,22,14,0.98), rgba(16,12,9,0.98))",
          border: "1px solid rgba(255,106,0,0.35)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          color: "var(--color-ink)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="j-glow-text text-sm" style={{ fontFamily: "var(--font-uncial)" }}>
            {pin.id ? (canEdit ? "Edit Pin" : "Pin") : "New Pin"}
          </div>
          <button className="j-btn j-btn-ghost !py-0.5 !px-2 text-xs" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!canEdit && pin.id ? (
          <div className="space-y-2">
            <div className="j-glow-text">
              {PIN_META[d.pin_type]?.emoji} {d.label || PIN_META[d.pin_type]?.label}
            </div>
            {d.description && <p className="text-sm whitespace-pre-wrap text-[var(--color-muted)]">{d.description}</p>}
            {linkedSession && (
              <div className="text-[11px] px-2 py-1 rounded-full inline-block" style={{ background: "rgba(255,106,0,0.1)", border: "1px solid rgba(255,106,0,0.25)" }}>
                📜 Session: {linkedSession.label}
              </div>
            )}
          </div>
        ) : (
          <>
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Type</span>
              <select
                className="w-full mt-1 rounded-lg px-2 py-1.5 text-sm"
                style={{ background: "rgba(8,6,4,0.7)", border: "1px solid rgba(255,106,0,0.25)", color: "var(--color-ink)" }}
                value={d.pin_type}
                onChange={(e) => setD({ ...d, pin_type: e.target.value as PinType })}
              >
                {allowedTypes.map((t) => (
                  <option key={t} value={t}>{PIN_META[t].emoji} {PIN_META[t].label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Label</span>
              <input
                className="w-full mt-1 rounded-lg px-2 py-1.5 text-sm"
                style={{ background: "rgba(8,6,4,0.7)", border: "1px solid rgba(255,106,0,0.25)", color: "var(--color-ink)" }}
                value={d.label}
                placeholder="Ember Hollow"
                onChange={(e) => setD({ ...d, label: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Description</span>
              <textarea
                rows={3}
                className="w-full mt-1 rounded-lg px-2 py-1.5 text-sm"
                style={{ background: "rgba(8,6,4,0.7)", border: "1px solid rgba(255,106,0,0.25)", color: "var(--color-ink)", resize: "vertical" }}
                value={d.description}
                onChange={(e) => setD({ ...d, description: e.target.value })}
              />
            </label>

            {sessions.length > 0 && (
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Linked Session</span>
                <select
                  className="w-full mt-1 rounded-lg px-2 py-1.5 text-sm"
                  style={{ background: "rgba(8,6,4,0.7)", border: "1px solid rgba(255,106,0,0.25)", color: "var(--color-ink)" }}
                  value={d.session_id ?? ""}
                  onChange={(e) => setD({ ...d, session_id: e.target.value || null })}
                >
                  <option value="">— none —</option>
                  {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
            )}

            {canToggleVisibility && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={d.is_visible_to_players}
                  onChange={(e) => setD({ ...d, is_visible_to_players: e.target.checked })}
                />
                <span>Visible to players {d.is_visible_to_players ? "" : "🔒"}</span>
              </label>
            )}

            <div className="flex gap-2 pt-1">
              <button
                className="j-btn !py-1 !px-3 text-xs flex-1"
                disabled={busy}
                onClick={async () => { setBusy(true); await onSave(d); setBusy(false); }}
              >
                {busy ? "Saving…" : pin.id ? "Save Pin" : "Place Pin"}
              </button>
              {canDelete && pin.id && onDelete && (
                <button
                  className="j-btn j-btn-ghost !py-1 !px-3 text-xs"
                  style={{ color: "var(--color-blood)" }}
                  disabled={busy}
                  onClick={async () => { setBusy(true); await onDelete(); setBusy(false); }}
                >
                  Delete
                </button>
              )}
            </div>
          </>
        )}

        {!canEdit && pin.id && canDelete && onDelete && (
          <button className="j-btn j-btn-ghost !py-1 !px-3 text-xs w-full" onClick={() => onDelete()}>Delete Pin</button>
        )}
      </div>
    </div>
  );
}
