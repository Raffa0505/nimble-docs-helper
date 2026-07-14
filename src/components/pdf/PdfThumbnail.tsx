import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

interface Props {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  rotation?: number;
  widthPx?: number;
}

export function PdfThumbnail({ pdf, pageNumber, rotation = 0, widthPx }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const THUMB_W = widthPx ?? 120;

  useEffect(() => {
    let c = false;
    pdf.getPage(pageNumber).then((p) => {
      if (!c) setPage(p);
    });
    return () => {
      c = true;
    };
  }, [pdf, pageNumber]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setVisible(true);
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!page || !visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const vp = page.getViewport({ scale: 1 });
    const scale = THUMB_W / vp.width;
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const task = page.render({ canvasContext: ctx, viewport, canvas });
    return () => task.cancel();
  }, [page, visible]);

  const h = page ? THUMB_W * (page.getViewport({ scale: 1 }).height / page.getViewport({ scale: 1 }).width) : 160;
  const rot = ((rotation % 360) + 360) % 360;
  const rotated = rot % 180 !== 0;
  const outerW = rotated ? h : THUMB_W;
  const outerH = rotated ? THUMB_W : h;

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-1">
      <div
        className="relative bg-white border border-border rounded-sm overflow-hidden"
        style={{ width: outerW, height: outerH }}
      >
        <div
          className="absolute"
          style={{
            width: THUMB_W,
            height: h,
            left: (outerW - THUMB_W) / 2,
            top: (outerH - h) / 2,
            transform: `rotate(${rot}deg)`,
            transformOrigin: "center center",
          }}
        >
          <canvas ref={canvasRef} className="block w-full h-full" />
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{pageNumber}</span>
    </div>
  );
}
