import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ChevronRight, ChevronDown } from "lucide-react";

interface OutlineItem {
  title: string;
  dest: unknown;
  items: OutlineItem[];
}

interface Props {
  pdf: PDFDocumentProxy;
  onNavigate: (pageNumber: number) => void;
}

export function PdfOutline({ pdf, onNavigate }: Props) {
  const [outline, setOutline] = useState<OutlineItem[] | null>(null);

  useEffect(() => {
    pdf.getOutline().then((o) => setOutline(o as OutlineItem[] | null));
  }, [pdf]);

  const handleClick = async (dest: unknown) => {
    try {
      let explicitDest = dest;
      if (typeof dest === "string") {
        explicitDest = await pdf.getDestination(dest);
      }
      if (!Array.isArray(explicitDest)) return;
      const ref = explicitDest[0];
      const pageIndex = await pdf.getPageIndex(ref);
      onNavigate(pageIndex + 1);
    } catch (e) {
      console.error(e);
    }
  };

  if (outline === null) {
    return <div className="p-4 text-xs text-muted-foreground">Caricamento indice…</div>;
  }
  if (outline.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Nessun indice o segnalibro disponibile in questo documento.
      </div>
    );
  }

  return (
    <div className="p-2">
      {outline.map((item, i) => (
        <OutlineNode key={i} item={item} depth={0} onClick={handleClick} />
      ))}
    </div>
  );
}

function OutlineNode({
  item,
  depth,
  onClick,
}: {
  item: OutlineItem;
  depth: number;
  onClick: (dest: unknown) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = item.items && item.items.length > 0;
  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 px-2 rounded hover:bg-sidebar-hover cursor-pointer text-sm"
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
            className="p-0.5 hover:bg-accent rounded"
            aria-label={open ? "Comprimi" : "Espandi"}
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span
          onClick={() => onClick(item.dest)}
          className="flex-1 truncate"
          title={item.title}
        >
          {item.title}
        </span>
      </div>
      {hasChildren && open && (
        <div>
          {item.items.map((child, i) => (
            <OutlineNode key={i} item={child} depth={depth + 1} onClick={onClick} />
          ))}
        </div>
      )}
    </div>
  );
}
