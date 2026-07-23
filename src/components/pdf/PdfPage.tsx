import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { AnnotationLayer } from "./AnnotationLayer";
import type { Annotation, HighlightColor, InkColor, Tool } from "@/lib/annotations";

interface Props {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation?: number;
  searchQuery: string;
  onVisible: (page: number) => void;
  registerRef: (page: number, el: HTMLDivElement | null) => void;
  tool: Tool;
  highlightColor: HighlightColor;
  inkColor: InkColor;
  inkSize: number;
  annotations: Annotation[];
  onAddAnnotation: (a: Annotation) => void;
  onUpdateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  onToolConsumed?: () => void;
}

export function PdfPage({
  pdf,
  pageNumber,
  scale,
  rotation = 0,
  searchQuery,
  onVisible,
  registerRef,
  tool,
  highlightColor,
  inkColor,
  inkSize,
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onToolConsumed,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    pdf.getPage(pageNumber).then((p) => {
      if (cancelled) return;
      setPage(p);
      const vp = p.getViewport({ scale: 1 });
      setDims({ w: vp.width, h: vp.height });
    });
    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          setVisible(e.isIntersecting);
          if (e.isIntersecting && e.intersectionRatio > 0.5) {
            onVisible(pageNumber);
          }
        }
      },
      { rootMargin: "600px 0px", threshold: [0, 0.5, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pageNumber, onVisible]);

  useEffect(() => {
    if (!page || !visible || !dims) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: scale * dpr });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${dims.w * scale}px`;
    canvas.style.height = `${dims.h * scale}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    renderTaskRef.current?.cancel();
    const task = page.render({ canvasContext: ctx, viewport, canvas });
    renderTaskRef.current = task;

    task.promise
      .then(async () => {
        const textLayer = textLayerRef.current;
        if (!textLayer) return;
        textLayer.innerHTML = "";
        const displayViewport = page.getViewport({ scale });
        textLayer.style.width = `${displayViewport.width}px`;
        textLayer.style.height = `${displayViewport.height}px`;
        const textContent = await page.getTextContent();
        const pdfjs = (await import("pdfjs-dist")) as unknown as {
          TextLayer: new (opts: {
            textContentSource: unknown;
            container: HTMLElement;
            viewport: unknown;
          }) => { render: () => Promise<void> };
        };
        const tl = new pdfjs.TextLayer({
          textContentSource: textContent,
          container: textLayer,
          viewport: displayViewport,
        });
        await tl.render();
        if (searchQuery.trim()) {
          highlightText(textLayer, searchQuery.trim());
        }
      })
      .catch((err) => {
        if (err?.name !== "RenderingCancelledException") console.error(err);
      });

    return () => {
      task.cancel();
    };
  }, [page, visible, scale, dims, searchQuery]);

  const width = dims ? dims.w * scale : 600;
  const height = dims ? dims.h * scale : 800;
  const rot = ((rotation % 360) + 360) % 360;
  const rotated = rot % 180 !== 0;
  const outerW = rotated ? height : width;
  const outerH = rotated ? width : height;

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        registerRef(pageNumber, el);
      }}
      data-page-number={pageNumber}
      className="relative mx-auto"
      style={{ width: outerW, height: outerH }}
    >
      <div
        className="absolute bg-white pdf-page-shadow rounded-sm"
        style={{
          width,
          height,
          left: (outerW - width) / 2,
          top: (outerH - height) / 2,
          transform: `rotate(${rot}deg)`,
          transformOrigin: "center center",
        }}
      >
        <canvas ref={canvasRef} className="block" style={{ width, height }} />
        <div ref={textLayerRef} className="textLayer" style={{ width, height }} />
        {dims && (
          <AnnotationLayer
            pageNumber={pageNumber}
            widthPx={width}
            heightPx={height}
            pageWidthPt={dims.w}
            pageHeightPt={dims.h}
            tool={tool}
            highlightColor={highlightColor}
            inkColor={inkColor}
            inkSize={inkSize}
            annotations={annotations}
            textLayerEl={textLayerRef.current}
            onAdd={onAddAnnotation}
            onUpdate={onUpdateAnnotation}
            onDelete={onDeleteAnnotation}
          />
        )}
      </div>
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground select-none">
        {pageNumber}
      </div>
    </div>
  );
}

function highlightText(container: HTMLElement, query: string) {
  const q = query.toLowerCase();
  const spans = container.querySelectorAll("span");
  spans.forEach((span) => {
    const text = span.textContent || "";
    const idx = text.toLowerCase().indexOf(q);
    if (idx >= 0) {
      const before = text.slice(0, idx);
      const match = text.slice(idx, idx + q.length);
      const after = text.slice(idx + q.length);
      span.innerHTML = `${escapeHtml(before)}<span class="highlight">${escapeHtml(match)}</span>${escapeHtml(after)}`;
    }
  });
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
