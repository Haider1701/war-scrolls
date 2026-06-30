import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

type Status = "idle" | "dirty" | "saving" | "saved";

export function NotesTab({ characterId, readOnly }: { characterId: string; readOnly: boolean }) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always read latest from refs inside async flush
  const contentRef = useRef("");
  const characterIdRef = useRef(characterId);
  const dirtyRef = useRef(false);

  async function flush() {
    if (!dirtyRef.current) return;
    const id = characterIdRef.current;
    const value = contentRef.current;
    setStatus("saving");
    const { error } = await db
      .from("free_notes")
      .upsert({ character_id: id, content: value }, { onConflict: "character_id" });
    if (!error) {
      dirtyRef.current = false;
      setStatus("saved");
    } else {
      setStatus("dirty");
    }
  }

  useEffect(() => {
    characterIdRef.current = characterId;
    let cancelled = false;
    (async () => {
      const { data } = await db
        .from("free_notes")
        .select("content")
        .eq("character_id", characterId)
        .maybeSingle();
      if (cancelled) return;
      const fresh = data?.content ?? "";
      setContent(fresh);
      contentRef.current = fresh;
      dirtyRef.current = false;
      setStatus("idle");
    })();
    return () => {
      cancelled = true;
      if (t.current) clearTimeout(t.current);
      // Save on unmount (tab switch / journal switch)
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  function onChange(v: string) {
    setContent(v);
    contentRef.current = v;
    dirtyRef.current = true;
    setStatus("dirty");
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(flush, 800);
  }

  return (
    <div className="j-fade">
      <div className="flex items-center justify-between mb-3">
        <h3 className="j-h text-xl">📜 Loose Pages</h3>
        {!readOnly && (
          <span className="text-xs italic text-[var(--color-muted)]" aria-live="polite">
            {status === "saving" && "Inscribing…"}
            {status === "dirty" && "Unsaved"}
            {status === "saved" && "✓ Saved"}
          </span>
        )}
      </div>
      {readOnly ? (
        <div className="j-card j-lined whitespace-pre-wrap min-h-[60vh]">
          {content || <span className="text-[var(--color-muted)] italic">No further notes scribed.</span>}
        </div>
      ) : (
        <textarea
          className="j-textarea j-lined w-full"
          style={{ minHeight: "60vh" }}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => { if (t.current) clearTimeout(t.current); flush(); }}
          placeholder="Inscribe further thoughts here…"
        />
      )}
    </div>
  );
}
