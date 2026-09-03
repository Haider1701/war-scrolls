import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PIN_META, type MapPin } from "@/lib/mapTypes";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 6;

type Props = {
  imageUrl: string;
  pins: MapPin[];
  /** Renders lock overlays on DM-only pins. */
  dmView?: boolean;
  /** Enables the 📍 Pin tool in the toolbar. */
  allowPinTool?: boolean;
  onPlace?: (xPercent: number, yPercent: number) => void;
  onPinClick?: (pin: MapPin) => void;
  /** Pins added within the last few seconds — pulse. */
  freshIds?: string[];
  /** Pins to spotlight (e.g. from a session link). */
  highlightIds?: string[];
  attributionFor?: (pin: MapPin) => string | undefined;
  onRetry?: () => void;
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** Pannable / zoomable battle-map surface with percentage-positioned pins. */
export function MapCanvas({
  imageUrl, pins, dmView, allowPinTool, onPlace, onPinClick,
  freshIds = [], highlightIds = [], attributionFor, onRetry,
}: Props) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "pin">("select");
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };
  const dragRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const pinchRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; zoom: number; cx: number; cy: number } | null>(null);

  const placing = !!allowPinTool && tool === "pin";

  const zoomAt = useCallback((next: number, px: number, py: number) => {
    const { zoom: z, offset: o } = stateRef.current;
    const nz = clamp(next, MIN_ZOOM, MAX_ZOOM);
    const k = nz / z;
    setZoom(nz);
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(stateRef.current.zoom * Math.exp(-dy * 0.0018), e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Reset when the map image changes
  useLayoutEffect(() => {
    setZoom(1); setOffset({ x: 0, y: 0 }); setFailed(false); setReady(false);
  }, [imageUrl]);

  function onPointerDown(e: React.PointerEvent) {
    pinchRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchRef.current.size === 2) {
      const [a, b] = Array.from(pinchRef.current.values());
      pinchStart.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: stateRef.current.zoom,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
      dragRef.current = null;
      return;
    }
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (pinchRef.current.has(e.pointerId)) pinchRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchStart.current && pinchRef.current.size >= 2) {
      const [a, b] = Array.from(pinchRef.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = containerRef.current!.getBoundingClientRect();
      zoomAt(
        pinchStart.current.zoom * (dist / pinchStart.current.dist),
        pinchStart.current.cx - rect.left,
        pinchStart.current.cy - rect.top,
      );
      return;
    }
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    d.x = e.clientX; d.y = e.clientY;
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }

  function onPointerUp(e: React.PointerEvent) {
    pinchRef.current.delete(e.pointerId);
    if (pinchRef.current.size < 2) pinchStart.current = null;
    dragRef.current = null;
  }

  function onSurfaceClick(e: React.MouseEvent) {
    if (!placing || !onPlace) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onPlace(clamp(x, 0, 100), clamp(y, 0, 100));
  }

  const step = (f: number) => {
    const el = containerRef.current;
    if (!el) return;
    zoomAt(stateRef.current.zoom * f, el.clientWidth / 2, el.clientHeight / 2);
  };

  const reset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  const toggleFullscreen = () => {
    const el = frameRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <div ref={frameRef} className="flex flex-col h-full gap-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {allowPinTool && (
          <div className="flex gap-1.5">
            <button
              className={`j-map-tool ${tool === "select" ? "is-active" : ""}`}
              onClick={() => setTool("select")}
              aria-pressed={tool === "select"}
            >🖱️ Select</button>
            <button
              className={`j-map-tool ${tool === "pin" ? "is-active" : ""}`}
              onClick={() => setTool("pin")}
              aria-pressed={tool === "pin"}
            >📍 Pin</button>
          </div>
        )}
        <div className="flex-1" />
        <div className="flex gap-1.5">
          <button className="j-map-tool" onClick={() => step(1.3)} aria-label="Zoom in">＋ Zoom In</button>
          <button className="j-map-tool" onClick={() => step(1 / 1.3)} aria-label="Zoom out">－ Zoom Out</button>
          <button className="j-map-tool" onClick={reset}>⊙ Reset</button>
          <button className="j-map-tool" onClick={toggleFullscreen}>⛶ Fullscreen</button>
        </div>
      </div>

      {/* Map surface */}
      <div className="relative flex-1 min-h-[420px] overflow-hidden rounded-xl j-map-frame">
        <div className="j-map-grid" aria-hidden />
        <div className="j-map-vignette" aria-hidden />

        {failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="text-3xl">🗺️</div>
            <div className="text-sm text-[var(--color-muted)] italic">This map image could not be loaded.</div>
            <button className="j-btn !py-1 !px-3 text-xs" onClick={() => { setFailed(false); onRetry?.(); }}>
              ⟳ Retry
            </button>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="absolute inset-0 touch-none select-none"
            style={{ cursor: placing ? "crosshair" : "grab" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
                width: "100%",
                position: "relative",
              }}
            >
              <div className="relative" onClick={onSurfaceClick}>
                <img
                  src={imageUrl}
                  alt="Campaign map"
                  className="block w-full h-auto pointer-events-none rounded-lg"
                  draggable={false}
                  onLoad={() => setReady(true)}
                  onError={() => setFailed(true)}
                />
                {pins.map((p) => {
                  const meta = PIN_META[p.pin_type] ?? PIN_META.poi;
                  const fresh = freshIds.includes(p.id);
                  const spot = highlightIds.includes(p.id);
                  const hidden = dmView && !p.is_visible_to_players;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`j-map-pin ${fresh ? "j-map-pin-fresh" : ""} ${spot ? "j-map-pin-spot" : ""}`}
                      style={{
                        left: `${p.x_percent}%`,
                        top: `${p.y_percent}%`,
                        transform: `translate(-50%, -100%) scale(${1 / zoom})`,
                        opacity: hidden ? 0.72 : 1,
                        filter: hidden ? "saturate(0.5)" : undefined,
                        ["--pin-color" as any]: meta.color,
                      }}
                      onClick={(e) => { e.stopPropagation(); onPinClick?.(p); }}
                      onMouseEnter={() => setHover(p.id)}
                      onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
                      aria-label={`${meta.label}: ${p.label || "unnamed"}`}
                    >
                      <span className="j-map-pin-dot">
                        <span aria-hidden>{meta.emoji}</span>
                        {hidden && <span className="j-map-pin-lock" aria-hidden>🔒</span>}
                      </span>
                      {(hover === p.id || spot) && (
                        <span className="j-map-tip">
                          {p.label || meta.label}
                          {attributionFor?.(p) && <em className="block opacity-75">— {attributionFor(p)}</em>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!failed && !ready && (
          <div className="absolute inset-0 flex items-center justify-center text-xs italic text-[var(--color-muted)]">
            Unrolling the map…
          </div>
        )}

        <div className="absolute bottom-3 right-3 text-[10px] px-2 py-0.5 rounded-full z-10"
          style={{ background: "rgba(8,5,2,0.75)", border: "1px solid rgba(255,106,0,0.3)" }}>
          {Math.round(zoom * 100)}%
        </div>
        {placing && (
          <div className="absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded-full z-10"
            style={{ background: "rgba(255,106,0,0.2)", border: "1px solid rgba(255,106,0,0.5)" }}>
            📍 Click the map to place a pin
          </div>
        )}
      </div>
    </div>
  );
}
