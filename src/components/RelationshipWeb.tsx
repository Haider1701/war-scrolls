import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { NPC } from "@/lib/types";

const db = supabase as any;

export type RelType = "ally" | "hostile" | "neutral" | "unknown";
export const REL_TYPES: RelType[] = ["ally", "hostile", "neutral", "unknown"];
export const REL_COLOR: Record<RelType, string> = {
  ally: "#4caf6e",
  hostile: "#c43030",
  neutral: "#e0b040",
  unknown: "#8a8a8a",
};

type Node = { id: string; x: number; y: number; vx: number; vy: number; fixed?: boolean };

const W = 800, H = 560;

export function RelationshipWeb({ characterId, npcs, rels }: {
  characterId: string; npcs: NPC[]; rels: Record<string, RelType>;
}) {
  const [me, setMe] = useState<{ name: string; image_url: string } | null>(null);
  const [nodes, setNodes] = useState<Record<string, Node>>({});
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [selected, setSelected] = useState<NPC | null>(null);
  const [mobile, setMobile] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string | null; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 599px)");
    const f = () => setMobile(mq.matches);
    f(); mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);

  useEffect(() => {
    db.from("characters").select("name,image_url").eq("id", characterId).maybeSingle()
      .then(({ data }: any) => setMe(data));
  }, [characterId]);

  // Seed positions in a ring around the centre
  useEffect(() => {
    setNodes((prev) => {
      const next: Record<string, Node> = { me: prev.me ?? { id: "me", x: W / 2, y: H / 2, vx: 0, vy: 0, fixed: true } };
      npcs.forEach((n, i) => {
        const a = (i / Math.max(1, npcs.length)) * Math.PI * 2;
        next[n.id] = prev[n.id] ?? { id: n.id, x: W / 2 + Math.cos(a) * 200, y: H / 2 + Math.sin(a) * 170, vx: 0, vy: 0 };
      });
      return next;
    });
  }, [npcs]);

  // Lightweight force simulation
  useEffect(() => {
    let raf = 0, ticks = 0;
    const step = () => {
      const cur = nodesRef.current;
      const list = Object.values(cur);
      if (list.length < 2) return;
      const next: Record<string, Node> = {};
      for (const n of list) next[n.id] = { ...n };
      const arr = Object.values(next);
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const d2 = Math.max(100, dx * dx + dy * dy), d = Math.sqrt(d2);
        const f = 9000 / d2; dx /= d; dy /= d;
        a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
      }
      const c = next.me;
      for (const n of arr) {
        if (n.id === "me") continue;
        const t = rels[n.id] ?? "unknown";
        const rest = t === "ally" ? 150 : t === "hostile" ? 240 : 195;
        const dx = n.x - c.x, dy = n.y - c.y, d = Math.max(1, Math.hypot(dx, dy));
        const f = (d - rest) * 0.02;
        n.vx -= (dx / d) * f; n.vy -= (dy / d) * f;
      }
      for (const n of arr) {
        if (n.fixed || drag.current?.id === n.id) { n.vx = n.vy = 0; continue; }
        n.vx *= 0.82; n.vy *= 0.82;
        n.x = Math.max(30, Math.min(W - 30, n.x + n.vx));
        n.y = Math.max(30, Math.min(H - 40, n.y + n.vy));
      }
      setNodes(next);
      if (++ticks < 240) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [npcs.length, rels]);

  function toWorld(e: React.PointerEvent | React.WheelEvent) {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W, sy = ((e.clientY - r.top) / r.height) * H;
    return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k, sx, sy };
  }

  function onDown(e: React.PointerEvent, id: string | null) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toWorld(e);
    drag.current = { id, sx: p.sx, sy: p.sy, vx: view.x, vy: view.y, moved: false };
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current; if (!d) return;
    const p = toWorld(e);
    if (Math.abs(p.sx - d.sx) + Math.abs(p.sy - d.sy) > 3) d.moved = true;
    if (d.id) {
      setNodes((ns) => ({ ...ns, [d.id!]: { ...ns[d.id!], x: p.x, y: p.y, vx: 0, vy: 0 } }));
    } else {
      setView((v) => ({ ...v, x: d.vx + (p.sx - d.sx), y: d.vy + (p.sy - d.sy) }));
    }
  }
  function onUp() {
    const d = drag.current; drag.current = null;
    if (d?.id && !d.moved && d.id !== "me") setSelected(npcs.find((n) => n.id === d.id) ?? null);
  }
  function zoom(f: number) {
    setView((v) => {
      const k = Math.max(0.4, Math.min(3, v.k * f));
      return { k, x: W / 2 - ((W / 2 - v.x) / v.k) * k, y: H / 2 - ((H / 2 - v.y) / v.k) * k };
    });
  }

  if (npcs.length === 0) return <div className="text-[var(--color-muted)] italic">No souls recorded yet — add an NPC to begin the web.</div>;

  if (mobile) {
    return (
      <div className="space-y-2">
        {npcs.map((n) => {
          const t = rels[n.id] ?? "unknown";
          return (
            <div key={n.id} className="j-card flex items-center gap-3 !py-2">
              <span className="text-2xl">{n.emoji_icon}</span>
              <span className="flex-1 truncate">{n.name}</span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ border: `1px solid ${REL_COLOR[t]}`, color: REL_COLOR[t] }}>{t}</span>
            </div>
          );
        })}
      </div>
    );
  }

  const c = nodes.me;

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ background: "radial-gradient(circle at center, rgba(40,26,14,0.9), rgba(10,7,4,0.95))", border: "1px solid rgba(255,106,0,0.25)" }}>
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button className="j-btn j-btn-ghost !px-2 !py-0.5" onClick={() => zoom(1.2)} aria-label="Zoom in">＋</button>
        <button className="j-btn j-btn-ghost !px-2 !py-0.5" onClick={() => zoom(1 / 1.2)} aria-label="Zoom out">－</button>
        <button className="j-btn j-btn-ghost !px-2 !py-0.5 text-xs" onClick={() => setView({ x: 0, y: 0, k: 1 })}>Reset</button>
      </div>
      <div className="absolute bottom-2 left-2 z-10 flex gap-3 text-[10px] uppercase tracking-widest">
        {REL_TYPES.map((t) => <span key={t} className="flex items-center gap-1"><span className="inline-block w-4 h-0.5" style={{ background: REL_COLOR[t] }} />{t}</span>)}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto touch-none select-none cursor-grab"
        onPointerDown={(e) => onDown(e, null)}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onWheel={(e) => zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1)}
      >
        <defs>
          <clipPath id="me-clip"><circle r="34" /></clipPath>
        </defs>
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {c && npcs.map((n) => {
            const p = nodes[n.id]; if (!p) return null;
            const t = rels[n.id] ?? "unknown";
            return <line key={"l" + n.id} x1={c.x} y1={c.y} x2={p.x} y2={p.y} stroke={REL_COLOR[t]} strokeWidth={2.5} strokeOpacity={0.8} strokeDasharray={t === "unknown" ? "6 5" : undefined} />;
          })}
          {npcs.map((n) => {
            const p = nodes[n.id]; if (!p) return null;
            const t = rels[n.id] ?? "unknown";
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`} className="cursor-pointer" onPointerDown={(e) => onDown(e, n.id)}
                style={{ filter: n.disposition === "deceased" ? "grayscale(1)" : undefined }}>
                <circle r="24" fill="rgba(16,11,6,0.95)" stroke={REL_COLOR[t]} strokeWidth={3} />
                <text textAnchor="middle" dominantBaseline="central" fontSize="22">{n.emoji_icon || "👤"}</text>
                <text y="40" textAnchor="middle" fontSize="12" fill="var(--color-ink)" style={{ fontFamily: "var(--font-fell)" }}>{n.name || "Unknown"}</text>
              </g>
            );
          })}
          {c && (
            <g transform={`translate(${c.x},${c.y})`} onPointerDown={(e) => onDown(e, "me")} className="cursor-move">
              <circle r="38" fill="rgba(255,106,0,0.15)" stroke="var(--color-flame)" strokeWidth={3} />
              {me?.image_url
                ? <image href={me.image_url} x={-34} y={-34} width={68} height={68} clipPath="url(#me-clip)" preserveAspectRatio="xMidYMid slice" />
                : <text textAnchor="middle" dominantBaseline="central" fontSize="30">⚔️</text>}
              <text y="56" textAnchor="middle" fontSize="14" fill="var(--color-flame)" style={{ fontFamily: "var(--font-uncial)" }}>{me?.name || "You"}</text>
            </g>
          )}
        </g>
      </svg>

      {selected && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50" onClick={() => setSelected(null)}>
          <div className="j-card max-w-sm w-[90%]" onClick={(e) => e.stopPropagation()} style={{ borderColor: REL_COLOR[rels[selected.id] ?? "unknown"] }}>
            <div className="flex items-start gap-3">
              <div className="text-4xl">{selected.emoji_icon}</div>
              <div className="flex-1 min-w-0">
                <div className="j-h text-xl">{selected.name}</div>
                <div className="italic text-sm text-[var(--color-muted)]">{selected.role}</div>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close">✕</button>
            </div>
            <div className="flex gap-2 mt-2">
              <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded disposition-${selected.disposition}`}>{selected.disposition}</span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded" style={{ border: `1px solid ${REL_COLOR[rels[selected.id] ?? "unknown"]}`, color: REL_COLOR[rels[selected.id] ?? "unknown"] }}>
                {rels[selected.id] ?? "unknown"}
              </span>
            </div>
            {selected.description && <p className="text-sm mt-3">{selected.description}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
