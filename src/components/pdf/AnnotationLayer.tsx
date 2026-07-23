import { useEffect, useRef, useState } from "react";
import { StickyNote, Trash2, X } from "lucide-react";
import type { Annotation, HighlightColor, InkColor, NormRect, Tool } from "@/lib/annotations";
import { HIGHLIGHT_COLORS, INK_COLORS, newId } from "@/lib/annotations";

const TEXT_FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72] as const;
const TEXT_COLORS: InkColor[] = ["black", "red", "blue", "green", "yellow"];


interface Props {
  pageNumber: number;
  widthPx: number;
  heightPx: number;
  pageWidthPt: number;
  pageHeightPt: number;
  tool: Tool;
  highlightColor: HighlightColor;
  inkColor: InkColor;
  inkSize: number;
  annotations: Annotation[];
  textLayerEl: HTMLElement | null;
  onAdd: (a: Annotation) => void;
  onUpdate: (id: string, patch: Partial<Annotation>) => void;
  onDelete: (id: string) => void;
  onToolConsumed?: () => void;
}

export function AnnotationLayer({
  pageNumber,
  widthPx,
  heightPx,
  pageHeightPt,
  tool,
  highlightColor,
  inkColor,
  inkSize,
  annotations,
  textLayerEl,
  onAdd,
  onUpdate,
  onDelete,
  onToolConsumed,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[] | null>(null);

  const scale = heightPx / pageHeightPt;

  useEffect(() => {
    if (tool !== "highlight" || !textLayerEl || !rootRef.current) return;
    const pageEl = rootRef.current.parentElement;
    if (!pageEl) return;

    const onMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (
        !textLayerEl.contains(range.startContainer) &&
        !textLayerEl.contains(range.endContainer)
      ) {
        return;
      }
      const pageRect = pageEl.getBoundingClientRect();
      const clientRects = Array.from(range.getClientRects());
      const rects: NormRect[] = clientRects
        .filter((r) => r.width > 1 && r.height > 1)
        .map((r) => ({
          x: (r.left - pageRect.left) / pageRect.width,
          y: (r.top - pageRect.top) / pageRect.height,
          w: r.width / pageRect.width,
          h: r.height / pageRect.height,
        }));
      if (rects.length === 0) return;
      onAdd({
        id: newId(),
        page: pageNumber,
        type: "highlight",
        color: highlightColor,
        rects,
      });
      sel.removeAllRanges();
    };

    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [tool, highlightColor, textLayerEl, pageNumber, onAdd]);

  const handleLayerClick = (e: React.MouseEvent) => {
    if (tool !== "note" && tool !== "text") return;
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (tool === "note") {
      const id = newId();
      onAdd({ id, page: pageNumber, type: "note", x, y, text: "" });
      setOpenNote(id);
    } else {
      onAdd({
        id: newId(),
        page: pageNumber,
        type: "text",
        x,
        y,
        w: 0.35,
        text: "",
        fontSize: 14,
      });
      // Auto-switch back to select so the user can immediately move/resize the box
      // without accidentally creating another one on the next click.
      onToolConsumed?.();
    }
  };

  const overlayInteractive =
    tool === "note" || tool === "text" || tool === "draw" || tool === "eraser";

  const posFromEvent = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const distToSegment = (
    p: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };

  const eraseAt = (p: { x: number; y: number }) => {
    const threshold = 0.012; // ~1.2% of page dimension
    for (const a of annotations) {
      if (a.type !== "ink") continue;
      for (let i = 0; i < a.points.length - 1; i++) {
        if (distToSegment(p, a.points[i], a.points[i + 1]) < threshold) {
          onDelete(a.id);
          break;
        }
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (tool === "draw") {
      if (e.target !== e.currentTarget) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDrawingPoints([posFromEvent(e)]);
    } else if (tool === "eraser") {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      eraseAt(posFromEvent(e));
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (tool === "draw" && drawingPoints) {
      const p = posFromEvent(e);
      setDrawingPoints((prev) => (prev ? [...prev, p] : prev));
    } else if (tool === "eraser" && e.buttons === 1) {
      eraseAt(posFromEvent(e));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (tool === "draw" && drawingPoints) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      if (drawingPoints.length >= 2) {
        onAdd({
          id: newId(),
          page: pageNumber,
          type: "ink",
          color: inkColor,
          size: inkSize,
          points: drawingPoints,
        });
      }
      setDrawingPoints(null);
    }
  };

  const cursorFor =
    tool === "note"
      ? "copy"
      : tool === "text"
        ? "text"
        : tool === "draw"
          ? "crosshair"
          : tool === "eraser"
            ? "cell"
            : "default";

  return (
    <div
      ref={rootRef}
      className="annotation-layer absolute inset-0"
      style={{
        width: widthPx,
        height: heightPx,
        pointerEvents: overlayInteractive ? "auto" : "none",
        cursor: cursorFor,
        touchAction: tool === "draw" || tool === "eraser" ? "none" : undefined,
      }}
      onClick={handleLayerClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Ink strokes overlay (rendered as SVG). Non-interactive; eraser hit-tests
          against annotation data on the parent layer instead. */}
      <svg
        className="absolute inset-0"
        width={widthPx}
        height={heightPx}
        viewBox={`0 0 ${widthPx} ${heightPx}`}
        style={{ pointerEvents: "none" }}
      >
        {annotations
          .filter((a): a is Extract<Annotation, { type: "ink" }> => a.type === "ink")
          .map((a) => (
            <polyline
              key={a.id}
              points={a.points.map((p) => `${p.x * widthPx},${p.y * heightPx}`).join(" ")}
              fill="none"
              stroke={INK_COLORS[a.color].css}
              strokeWidth={a.size * scale}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        {drawingPoints && drawingPoints.length > 0 && (
          <polyline
            points={drawingPoints.map((p) => `${p.x * widthPx},${p.y * heightPx}`).join(" ")}
            fill="none"
            stroke={INK_COLORS[inkColor].css}
            strokeWidth={inkSize * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      {annotations.map((a) => {

        if (a.type === "highlight") {
          const color = HIGHLIGHT_COLORS[a.color].css;
          return (
            <div key={a.id}>
              {a.rects.map((r, i) => (
                <div
                  key={i}
                  className="absolute rounded-[1px]"
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`,
                    height: `${r.h * 100}%`,
                    background: color,
                    pointerEvents: "auto",
                    mixBlendMode: "multiply",
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onDelete(a.id);
                  }}
                  title="Clic destro per eliminare evidenziazione"
                />
              ))}
            </div>
          );
        }
        if (a.type === "note") {
          return (
            <div
              key={a.id}
              className="absolute"
              style={{
                left: `${a.x * 100}%`,
                top: `${a.y * 100}%`,
                pointerEvents: "auto",
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenNote(openNote === a.id ? null : a.id);
                }}
                className="-translate-y-1 flex items-center justify-center h-6 w-6 rounded-sm bg-yellow-300 text-yellow-900 shadow-md ring-1 ring-yellow-500/50 hover:scale-110 transition-transform"
                title={a.text || "Nota"}
              >
                <StickyNote className="h-3.5 w-3.5" />
              </button>
              {openNote === a.id && (
                <div
                  className="absolute z-20 top-6 left-0 w-64 rounded-md border border-border bg-popover text-popover-foreground shadow-xl p-2"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">Nota</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          onDelete(a.id);
                          setOpenNote(null);
                        }}
                        className="p-1 rounded hover:bg-accent text-muted-foreground"
                        title="Elimina nota"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setOpenNote(null)}
                        className="p-1 rounded hover:bg-accent text-muted-foreground"
                        title="Chiudi"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    autoFocus
                    value={a.text}
                    onChange={(e) => onUpdate(a.id, { text: e.target.value })}
                    placeholder="Scrivi un commento…"
                    className="w-full h-24 text-sm p-1.5 rounded border border-input bg-background text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}
            </div>
          );
        }
        if (a.type === "text") {
          return (
            <TextAnnotation
              key={a.id}
              a={a}
              scale={scale}
              onUpdate={(patch) => onUpdate(a.id, patch)}
              onDelete={() => onDelete(a.id)}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

function TextAnnotation({
  a,
  scale,
  onUpdate,
  onDelete,
}: {
  a: Extract<Annotation, { type: "text" }>;
  scale: number;
  onUpdate: (patch: Partial<Annotation>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(() => !a.text);
  const [dragging, setDragging] = useState(false);
  const fontPx = a.fontSize * scale;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const currentColor: InkColor = a.color ?? "black";

  const getPageRect = () => {
    const layer = wrapRef.current?.parentElement;
    return (layer ?? wrapRef.current)?.getBoundingClientRect();
  };

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (editing) return;
    if ((e.target as HTMLElement).closest("[data-role='resize'],[data-role='delete'],[data-role='menu']")) return;
    const parentRect = getPageRect();
    if (!parentRect) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const startAx = a.x;
    const startAy = a.y;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / parentRect.width;
      const dy = (ev.clientY - startY) / parentRect.height;
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 3) {
        moved = true;
        setDragging(true);
      }
      if (moved) {
        const nx = Math.max(0, Math.min(1 - a.w, startAx + dx));
        const ny = Math.max(0, Math.min(0.999, startAy + dy));
        onUpdate({ x: nx, y: ny });
      }
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!moved) setEditing(true);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const parentRect = getPageRect();
    if (!parentRect) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = a.w;
    const startFont = a.fontSize;

    const onMove = (ev: PointerEvent) => {
      const dw = (ev.clientX - startX) / parentRect.width;
      const nw = Math.max(0.05, Math.min(1 - a.x, startW + dw));
      const dfy = (ev.clientY - startY) / scale;
      const nf = Math.max(8, Math.min(96, startFont + dfy * 0.5));
      onUpdate({ w: nw, fontSize: nf });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const textColorCss = INK_COLORS[currentColor].css;

  return (
    <div
      ref={wrapRef}
      className="absolute group"
      style={{
        left: `${a.x * 100}%`,
        top: `${a.y * 100}%`,
        width: `${a.w * 100}%`,
        pointerEvents: "auto",
        cursor: editing ? "text" : dragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={handleDragStart}
    >
      {editing ? (
        <>
          <textarea
            autoFocus
            value={a.text}
            placeholder="Scrivi qui…"
            onChange={(e) => onUpdate({ text: e.target.value })}
            onBlur={(e) => {
              const next = e.relatedTarget as HTMLElement | null;
              if (next && next.closest("[data-role='menu']")) return;
              setEditing(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ fontSize: fontPx, lineHeight: 1.2, color: textColorCss }}
            className="w-full min-h-[2em] p-1 border border-primary/60 bg-transparent rounded-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
          />
          <div
            data-role="menu"
            onMouseDown={(e) => {
              // Prevent the textarea from blurring (which would close this menu)
              // when clicking chrome, but let native form controls (select/option)
              // receive their own mousedown so the dropdown works.
              const tag = (e.target as HTMLElement).tagName;
              if (tag !== "SELECT" && tag !== "OPTION") e.preventDefault();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute -top-11 left-0 z-30 flex items-center gap-2 rounded-md border border-border bg-popover text-popover-foreground shadow-xl px-2 py-1"
          >
            <select
              value={a.fontSize}
              onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
              className="h-7 text-xs rounded border border-input bg-background px-1 focus:outline-none focus:ring-1 focus:ring-ring"
              title="Dimensione carattere"
            >
              {TEXT_FONT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onUpdate({ color: c })}
                  className={`h-5 w-5 rounded-full border ${currentColor === c ? "ring-2 ring-ring ring-offset-1 ring-offset-popover border-transparent" : "border-border"}`}
                  style={{ background: INK_COLORS[c].css }}
                  title={c}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => onDelete()}
              className="p-1 rounded hover:bg-accent text-muted-foreground"
              title="Elimina"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          style={{ fontSize: fontPx, lineHeight: 1.2, color: textColorCss }}
          className="whitespace-pre-wrap px-1 py-0.5 rounded-sm border border-transparent group-hover:border-primary/50 group-hover:bg-primary/5 select-none"
          title="Clic per modificare · Trascina per spostare · Trascina l'angolo per ridimensionare"
        >
          {a.text || " "}
        </div>
      )}
      {/* Resize handle (bottom-right) */}
      <div
        data-role="resize"
        onPointerDown={handleResizeStart}
        className="absolute -bottom-1 -right-1 h-3 w-3 rounded-sm bg-primary border border-background opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ cursor: "nwse-resize" }}
        title="Trascina per ridimensionare"
      />
      <button
        data-role="delete"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow"
        title="Elimina"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
