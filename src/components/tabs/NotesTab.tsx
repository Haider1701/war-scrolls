import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export function NotesTab({ characterId, readOnly }: { characterId: string; readOnly: boolean }) {
  const [content, setContent] = useState("");
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await db.from("free_notes").select("content").eq("character_id", characterId).maybeSingle();
      setContent(data?.content ?? "");
    })();
  }, [characterId]);

  function onChange(v: string) {
    setContent(v);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => {
      db.from("free_notes").update({ content: v }).eq("character_id", characterId);
    }, 600);
  }

  return (
    <div className="j-fade">
      <h3 className="j-h text-xl mb-3">📜 Loose Pages</h3>
      {readOnly ? (
        <div className="j-card j-lined whitespace-pre-wrap min-h-[60vh]" style={{ padding: "1rem 1.25rem", lineHeight: "32px" }}>
          {content || <span className="text-[var(--color-muted)] italic">No further notes scribed.</span>}
        </div>
      ) : (
        <textarea
          className="j-textarea j-lined w-full"
          style={{ minHeight: "60vh", padding: "1rem 1.25rem", lineHeight: "32px" }}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Inscribe further thoughts here…"
        />
      )}
    </div>
  );
}
