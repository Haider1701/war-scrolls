import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PIN_META, type MapPin } from "@/lib/mapTypes";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 6;

type Props = {
  imageUrl: string;
  pins: MapPin[];
  /** Renders lock overlays on DM-only pins. */
  dmView?: boolean;
  /** Clicking empty map space places a pin. */
  canPlace?: boolean;
  onPlace?: (xPercent: number, yPercent: number) => void;
  onPinClick?: (pin: MapPin) => void;
  /** Pins added within the last few seconds — pulse. */
  freshIds?: string[];
  /** Pins to spotlight (e.g. from a session link). */
  highlightIds?: string[];
  attributionFor?: (pin: MapPin) => string | undefined;
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** Pannable / zoomable map surface with percentage-positioned pins. */
export function MapCanvas({
  imageUrl, pins, dmView, canPlace, onPlace, onPinClick, freshIds = [], highlightIds = [], attributionFor,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };
  const dragRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const pinchRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; zoom: number; cx: number; cy: number } | null>(null);

  const zoomAt = useCallback((next: number, px: number, py: number) => {
    const { zoom: z, offset: o } = stateRef.current;
    const nz = clamp(next, MIN_ZOOM, MAX_ZOOM);
    const k = nz / z;
    setZoom(nz);
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
  }, []);

  const wheelRef = useRef((e: WheelEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    zoomAt(stateRef.current.zoom * Math.exp(-dy * 0.0018), e.clientX - rect.left, e.clientY - rect.top);
  });
  wheelRef.current = (e: WheelEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    zoomAt(stateRef.current.zoom * Math.exp(-dy * 0.0018), e.clientX - rect.left, e.clientY - rect.top);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); wheelRef.current(e); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Reset view when the map image changes
  useLayoutEffect(() => { setZoom(1); setOffset({ x: 0, y: 0 }); }, [imageUrl]);

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
    if (!canPlace || !onPlace) return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onPlace(clamp(x, 0, 100), clamp(y, 0, 100));
  }

  const step = (f: number) => {
    const el = containerRef.current;
    if (!el) return;
    zoomAt(stateRef.current.zoom * f, el.clientWidth / 2, el.clientHeight / 2);
  };

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl j-map-frame">
      <div
        ref={containerRef}
        className="absolute inset-0 touch-none select-none"
        style={{ cursor: canPlace ? "crosshair" : "grab" }}
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
            <img src={imageUrl} alt="Campaign map" className="block w-full h-auto pointer-events-none" draggable={false} />
            {pins.map((p) => {
              const meta = PIN_META[p.pin_type] ?? PIN_META.poi;
              const fresh = freshIds.includes(p.id);
              const spot = highlightIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`j-map-pin ${fresh ? "j-map-pin-fresh" : ""} ${spot ? "j-map-pin-spot" : ""}`}
                  style={{
                    left: `${p.x_percent}%`,
                    top: `${p.y_percent}%`,
                    transform: `translate(-50%, -100%) scale(${1 / zoom})`,
                    ["--pin-color" as any]: meta.color,
                  }}
                  onClick={(e) => { e.stopPropagation(); onPinClick?.(p); }}
                  onMouseEnter={() => setHover(p.id)}
                  onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
                  aria-label={`${meta.label}: ${p.label || "unnamed"}`}
                >
                  <span className="j-map-pin-dot">
                    <span aria-hidden>{meta.emoji}</span>
                    {dmView && !p.is_visible_to_players && <span className="j-map-pin-lock" aria-hidden>🔒</span>}
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

      <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
        <button className="j-map-ctl" onClick={() => step(1.3)} aria-label="Zoom in">+</button>
        <button className="j-map-ctl" onClick={() => step(1 / 1.3)} aria-label="Zoom out">−</button>
        <button className="j-map-ctl text-[10px]" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} aria-label="Reset view">⤾</button>
      </div>
      <div className="absolute bottom-3 left-3 text-[10px] text-[var(--color-muted)] bg-[rgba(8,5,2,0.6)] px-2 py-0.5 rounded-full z-10">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
