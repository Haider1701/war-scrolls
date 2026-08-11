import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TONES = [
  { id: "dark and tragic", label: "☠️ Dark & Tragic" },
  { id: "heroic and bold", label: "⚔️ Heroic & Bold" },
  { id: "mysterious and complex", label: "🎭 Mysterious & Complex" },
  { id: "humble and grounded", label: "🌿 Humble & Grounded" },
  { id: "lighthearted and fun", label: "😄 Lighthearted & Fun" },
];

const STYLES = [
  { id: "narrative prose", label: "📖 Narrative prose" },
  { id: "epic chronicle", label: "📜 Epic chronicle" },
  { id: "first person journal", label: "💬 First person journal" },
];

export const FREE_GENERATIONS = 5;

type Props = {
  race: string;
  klass: string;
  alignment: string;
  hasExisting: boolean;
  onKeep: (text: string) => void;
  onClose: () => void;
};

type Phase = "confirm" | "form" | "streaming" | "done" | "error";

/** AI backstory generator: inputs → streamed generation → keep / regenerate / edit. */
export function BackstoryGeneratorModal({ race, klass, alignment, hasExisting, onKeep, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>(hasExisting ? "confirm" : "form");
  const [tone, setTone] = useState(TONES[2].id);
  const [style, setStyle] = useState(STYLES[0].id);
  const [extra, setExtra] = useState("");
  const [text, setText] = useState("");
  const [editable, setEditable] = useState(false);
  const [error, setError] = useState("");
  const [used, setUsed] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const outRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await (supabase as any)
        .from("user_profiles")
        .select("ai_backstory_count")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      setUsed(data?.ai_backstory_count ?? 0);
    })();
  }, [phase === "done"]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight;
  }, [text]);

  async function generate() {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("No internet connection.");
      setPhase("error");
      return;
    }
    setError("");
    setText("");
    setEditable(false);
    setPhase("streaming");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/generate-backstory", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ race, class: klass, alignment, tone, style, extra }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let msg = "AI generation is temporarily unavailable.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
          if (typeof j?.used === "number") setUsed(j.used);
        } catch { /* keep default */ }
        setError(msg);
        setPhase("error");
        return;
      }

      const usedHeader = res.headers.get("x-generations-used");
      if (usedHeader) setUsed(Number(usedHeader));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setText(acc);
      }
      if (!acc.trim()) {
        setError("The story never took shape. Please retry.");
        setPhase("error");
        return;
      }
      setPhase("done");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(
        typeof navigator !== "undefined" && navigator.onLine === false
          ? "No internet connection."
          : e?.message || "AI generation is temporarily unavailable.",
      );
      setPhase("error");
    }
  }

  const limitReached = used !== null && used >= FREE_GENERATIONS;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 bg-[rgba(8,5,2,0.75)] backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label="Generate backstory">
      <div className="j-page w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 md:p-7 relative">
        <div className="flex items-start gap-3 mb-2">
          <h2 className="j-h text-2xl flex-1">✨ Generate Backstory</h2>
          <button className="j-btn j-btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {used !== null && (
          <p className={`text-xs mb-3 ${limitReached ? "text-[var(--color-blood)]" : "text-[var(--color-muted)]"}`}>
            ✨ {Math.min(used, FREE_GENERATIONS)}/{FREE_GENERATIONS} free generations used
          </p>
        )}

        {phase === "confirm" && (
          <div className="space-y-4">
            <div className="j-affliction text-sm">This will replace your current backstory. Continue?</div>
            <div className="flex gap-2 justify-end">
              <button className="j-btn j-btn-ghost" onClick={onClose}>Cancel</button>
              <button className="j-btn" onClick={() => setPhase("form")}>Overwrite</button>
            </div>
          </div>
        )}

        {(phase === "form" || phase === "error") && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <Info label="Class(es)" v={klass} />
              <Info label="Race" v={race} />
              <Info label="Alignment" v={alignment} />
            </div>

            <Group label="Tone">
              {TONES.map((t) => (
                <Chip key={t.id} active={tone === t.id} onClick={() => setTone(t.id)}>{t.label}</Chip>
              ))}
            </Group>

            <Group label="Writing style">
              {STYLES.map((s) => (
                <Chip key={s.id} active={style === s.id} onClick={() => setStyle(s.id)}>{s.label}</Chip>
              ))}
            </Group>

            <label className="block">
              <span className="text-xs uppercase tracking-widest text-[var(--color-muted)] block mb-1">
                Optional extra details ({extra.length}/200)
              </span>
              <textarea
                className="j-textarea"
                rows={3}
                maxLength={200}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="Add any specific details: a key event, a name, a location…"
              />
            </label>

            {error && <div className="j-affliction text-sm">{error}</div>}

            <div className="flex justify-end gap-2">
              <button className="j-btn j-btn-ghost" onClick={onClose}>Cancel</button>
              <button className="j-btn" disabled={limitReached} onClick={generate}
                title={limitReached ? "Free generation limit reached" : ""}>
                {phase === "error" ? "🔄 Retry" : "⚡ Generate"}
              </button>
            </div>
          </div>
        )}

        {(phase === "streaming" || phase === "done") && (
          <div className="space-y-4">
            {editable ? (
              <textarea className="j-textarea text-justify" rows={14} style={{ textIndent: "2em" }}
                value={text} onChange={(e) => setText(e.target.value)} />
            ) : (
              <div ref={outRef}
                className="j-card whitespace-pre-wrap text-justify max-h-[46vh] overflow-y-auto"
                style={{ textIndent: "2em", lineHeight: 1.9 }}>
                {text}
                {phase === "streaming" && <span className="j-caret">▍</span>}
              </div>
            )}

            {phase === "streaming" ? (
              <p className="text-xs text-[var(--color-muted)] italic flex items-center gap-2">
                <span className="j-spinner" /> The embers are writing…
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 justify-end">
                {!editable && (
                  <button className="j-btn j-btn-ghost" onClick={() => setEditable(true)}>✏️ Edit First</button>
                )}
                <button className="j-btn j-btn-ghost" disabled={limitReached} onClick={generate}>🔄 Regenerate</button>
                <button className="j-btn" onClick={() => onKeep(text)}>✅ Keep This</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, v }: { label: string; v: string }) {
  return (
    <div className="j-card py-2">
      <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">{label}</div>
      <div className="j-glow-text truncate">{v || "—"}</div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-xl text-sm border transition ${
        active
          ? "border-[var(--color-ember)] bg-[rgba(255,106,0,0.16)] j-glow-text"
          : "border-[rgba(255,106,0,0.25)] text-[var(--color-muted)] hover:border-[var(--color-ember)]"
      }`}
    >
      {children}
    </button>
  );
}
