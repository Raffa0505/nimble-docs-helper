import { useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Trash2, RotateCw, RotateCcw, GripVertical } from "lucide-react";
import { PdfThumbnail } from "./PdfThumbnail";

interface Props {
  pdf: PDFDocumentProxy;
  pageOrder: number[];
  rotations: Record<number, number>;
  onReorder: (next: number[]) => void;
  onDelete: (page: number) => void;
  onRotate: (page: number, dir: 1 | -1) => void;
}

export function PdfOrganizeGrid({
  pdf,
  pageOrder,
  rotations,
  onReorder,
  onDelete,
  onRotate,
}: Props) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDrop = (targetIdx: number) => {
    if (dragging === null || dragging === targetIdx) {
      setDragging(null);
      setOverIdx(null);
      return;
    }
    const next = [...pageOrder];
    const [moved] = next.splice(dragging, 1);
    next.splice(targetIdx, 0, moved);
    onReorder(next);
    setDragging(null);
    setOverIdx(null);
  };

  return (
    <div className="p-6 bg-viewer-bg min-h-full">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 text-sm text-muted-foreground">
          Trascina per riordinare · Ruota o elimina le pagine · Le modifiche
          verranno applicate all'esportazione.
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
          {pageOrder.map((pageNum, idx) => (
            <div
              key={pageNum}
              draggable
              onDragStart={() => setDragging(idx)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIdx(idx);
              }}
              onDragLeave={() => setOverIdx((v) => (v === idx ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(idx);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOverIdx(null);
              }}
              className={`group relative flex flex-col items-center gap-2 p-3 rounded-lg border bg-card transition-all ${
                overIdx === idx && dragging !== idx
                  ? "border-primary ring-2 ring-primary"
                  : "border-border"
              } ${dragging === idx ? "opacity-40" : "hover:border-primary/50"}`}
            >
              <div className="absolute top-1 left-1 text-muted-foreground/60 cursor-grab active:cursor-grabbing">
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="pointer-events-none">
                <PdfThumbnail
                  pdf={pdf}
                  pageNumber={pageNum}
                  rotation={rotations[pageNum] || 0}
                  widthPx={140}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Posizione {idx + 1} · Originale p.{pageNum}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onRotate(pageNum, -1)}
                  title="Ruota a sinistra"
                  className="p-1.5 rounded hover:bg-accent text-foreground"
                  aria-label="Ruota a sinistra"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onRotate(pageNum, 1)}
                  title="Ruota a destra"
                  className="p-1.5 rounded hover:bg-accent text-foreground"
                  aria-label="Ruota a destra"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete(pageNum)}
                  title="Elimina pagina"
                  className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                  aria-label="Elimina pagina"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        {pageOrder.length === 0 && (
          <div className="text-center text-muted-foreground py-16">
            Tutte le pagine sono state eliminate.
          </div>
        )}
      </div>
    </div>
  );
}
