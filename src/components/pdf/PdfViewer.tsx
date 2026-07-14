import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  Images,
  ListTree,
  X,
  ChevronUp,
  ChevronDown,
  FileText,
  MousePointer2,
  Hand,
  XCircle,
  Highlighter,
  StickyNote,
  Type,
  Download,
  Save,
  Star,
  Columns2,
  RotateCw,
  RotateCcw,
  LayoutGrid,
} from "lucide-react";

import { loadPdfjs } from "@/lib/pdfjs-loader";
import { useTheme } from "@/hooks/use-theme";
import { DropZone } from "./DropZone";
import { PdfPage } from "./PdfPage";
import { PdfThumbnail } from "./PdfThumbnail";
import { PdfOutline } from "./PdfOutline";
import { RecentsAndFavorites } from "./RecentsAndFavorites";
import { PdfOrganizeGrid } from "./PdfOrganizeGrid";
import type { Annotation, HighlightColor, Tool } from "@/lib/annotations";
import { HIGHLIGHT_COLORS } from "@/lib/annotations";
import { exportAnnotatedPdf } from "@/lib/export-pdf";
import {
  recordOpen,
  toggleFavorite,
  isFavorite,
  onLibraryChange,
} from "@/lib/pdf-library";

type SidebarTab = "thumbs" | "outline";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.1;

export function PdfViewer({
  onToggleSplit,
  splitActive = false,
}: {
  onToggleSplit?: () => void;
  splitActive?: boolean;
} = {}) {
  const { isDark, toggle: toggleTheme } = useTheme();
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileId, setFileId] = useState<string>("");
  const [isFav, setIsFav] = useState<boolean>(false);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("thumbs");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageInput, setPageInput] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [annTool, setAnnTool] = useState<Exclude<Tool, "pan" | "select"> | "select">("select");
  const [highlightColor, setHighlightColor] = useState<HighlightColor>("yellow");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [originalBytes, setOriginalBytes] = useState<ArrayBuffer | null>(null);
  const [exporting, setExporting] = useState(false);
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [organizeMode, setOrganizeMode] = useState(false);


  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Keep favorite state in sync with library changes (e.g. removed from empty screen).
  useEffect(() => {
    if (!fileId) return;
    const sync = () => setIsFav(isFavorite(fileId));
    sync();
    return onLibraryChange(sync);
  }, [fileId]);

  const openFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      // Keep a pristine copy for pdf-lib export; pdf.js may detach the buffer.
      const forExport = buffer.slice(0);
      const forPdfjs = buffer.slice(0);
      const pdfjs = await loadPdfjs();
      const task = pdfjs.getDocument({ data: forPdfjs });
      const doc = await task.promise;
      setPdf(doc);
      setNumPages(doc.numPages);
      setFileName(file.name);
      setCurrentPage(1);
      setPageInput("1");
      setAnnotations([]);
      setOriginalBytes(forExport);
      setRotations({});
      setPageOrder(Array.from({ length: doc.numPages }, (_, i) => i + 1));
      setOrganizeMode(false);
      // Persist to library and remember id for favorite toggle.
      try {
        const id = await recordOpen(file);
        setFileId(id);
        setIsFav(isFavorite(id));
      } catch (err) {
        console.warn("[PdfViewer] failed to record open", err);
      }
    } catch (e) {
      console.error(e);
      setError("Impossibile aprire il file. Assicurati che sia un PDF valido.");
    } finally {
      setLoading(false);
    }
  }, []);

  const closeFile = useCallback(() => {
    setPdf(null);
    setNumPages(0);
    setCurrentPage(1);
    setPageInput("1");
    setFileName("");
    setFileId("");
    setIsFav(false);
    setScale(1.2);
    setSearchQuery("");
    setSearchOpen(false);
    setPanMode(false);
    setSpaceHeld(false);
    setError(null);
    setAnnotations([]);
    setOriginalBytes(null);
    setAnnTool("select");
    setRotations({});
    setPageOrder([]);
    setOrganizeMode(false);
    pageRefs.current.clear();
  }, []);

  const rotateCurrentPage = useCallback(
    (dir: 1 | -1) => {
      setRotations((prev) => {
        const cur = prev[currentPage] || 0;
        const next = (((cur + dir * 90) % 360) + 360) % 360;
        return { ...prev, [currentPage]: next };
      });
    },
    [currentPage],
  );

  const rotatePage = useCallback((page: number, dir: 1 | -1) => {
    setRotations((prev) => {
      const cur = prev[page] || 0;
      const next = (((cur + dir * 90) % 360) + 360) % 360;
      return { ...prev, [page]: next };
    });
  }, []);

  const deletePage = useCallback((page: number) => {
    setPageOrder((prev) => prev.filter((p) => p !== page));
  }, []);

  const handleToggleFavorite = useCallback(() => {
    if (!fileId) return;
    setIsFav(toggleFavorite(fileId));
  }, [fileId]);

  const addAnnotation = useCallback((a: Annotation) => {
    setAnnotations((prev) => [...prev, a]);
  }, []);
  const updateAnnotation = useCallback((id: string, patch: Partial<Annotation>) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a)),
    );
  }, []);
  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleExport = useCallback(async () => {
    if (!originalBytes) return;
    setExporting(true);
    try {
      // pdf-lib needs its own buffer; copy so we can export again later.
      await exportAnnotatedPdf(originalBytes.slice(0), annotations, fileName, {
        pageOrder,
        rotations,
      });
    } catch (e) {
      console.error(e);
      setError("Errore durante l'esportazione del PDF annotato.");
    } finally {
      setExporting(false);
    }
  }, [originalBytes, annotations, fileName, pageOrder, rotations]);

  const handleSaveAs = useCallback(async () => {
    if (!originalBytes) return;
    const base = fileName.replace(/\.pdf$/i, "") || "documento";
    const suggested = `${base}-annotato.pdf`;
    const chosen = window.prompt("Salva con nome:", suggested);
    if (chosen === null) return; // user cancelled
    const trimmed = chosen.trim();
    if (!trimmed) return;
    setExporting(true);
    try {
      await exportAnnotatedPdf(originalBytes.slice(0), annotations, fileName, {
        pageOrder,
        rotations,
        downloadName: trimmed,
      });
    } catch (e) {
      console.error(e);
      setError("Errore durante il salvataggio del PDF.");
    } finally {
      setExporting(false);
    }
  }, [originalBytes, annotations, fileName, pageOrder, rotations]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const registerPageRef = useCallback((page: number, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(page, el);
    else pageRefs.current.delete(page);
  }, []);

  const scrollToPage = useCallback((page: number) => {
    const el = pageRefs.current.get(page);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleZoomIn = () => setScale((s) => Math.min(MAX_SCALE, +(s + ZOOM_STEP).toFixed(2)));
  const handleZoomOut = () => setScale((s) => Math.max(MIN_SCALE, +(s - ZOOM_STEP).toFixed(2)));
  const handleFitPage = () => {
    if (!scrollRef.current || !pdf) return;
    pdf.getPage(currentPage).then((p) => {
      const vp = p.getViewport({ scale: 1 });
      const container = scrollRef.current!;
      const availH = container.clientHeight - 64;
      const availW = container.clientWidth - 64;
      const s = Math.min(availW / vp.width, availH / vp.height);
      setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, +s.toFixed(2))));
    });
  };

  // Ctrl/Cmd + wheel zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.005;
        setScale((s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, +(s + delta).toFixed(2))));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [pdf]);

  // Pinch zoom (touch)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let startDist = 0;
    let startScale = scale;
    const dist = (t: TouchList) => {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.hypot(dx, dy);
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        startScale = scale;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        const d = dist(e.touches);
        const ratio = d / startDist;
        setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, +(startScale * ratio).toFixed(2))));
      }
    };
    el.addEventListener("touchstart", onStart);
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
    };
  }, [scale]);

  const [spaceHeld, setSpaceHeld] = useState(false);
  const panActive = panMode || spaceHeld;

  // Dynamic browser tab title based on opened file
  useEffect(() => {
    document.title = fileName ? `Lettore PDF - ${fileName}` : "Lettore PDF";
  }, [fileName]);

  // Keyboard: Tab toggles pan mode, Space (hold) temporarily enables it, +/- zoom
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Tab") {
        e.preventDefault();
        setPanMode((v) => !v);
      } else if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        setSpaceHeld(true);
      } else if (e.key === "Escape" && panMode) {
        setPanMode(false);
      } else if (e.key === "+" || e.key === "=" || e.key === "NumpadAdd") {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-" || e.key === "NumpadSubtract") {
        e.preventDefault();
        handleZoomOut();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        setSpaceHeld(false);
      }
    };
    const onBlur = () => setSpaceHeld(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [panMode]);

  // Mouse drag panning when pan mode is active
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !panActive) return;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;
    let dragging = false;

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      setIsPanning(true);
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = el.scrollLeft;
      startScrollTop = el.scrollTop;
      e.preventDefault();
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      el.scrollLeft = startScrollLeft - (e.clientX - startX);
      el.scrollTop = startScrollTop - (e.clientY - startY);
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      setIsPanning(false);
    };

    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [panActive]);


  const handlePageVisible = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);


  const pages = useMemo(() => {
    if (!pdf) return [];
    return pageOrder.length > 0
      ? pageOrder
      : Array.from({ length: numPages }, (_, i) => i + 1);
  }, [pdf, numPages, pageOrder]);

  if (!pdf) {
    return (
      <div className="h-full flex flex-col bg-background overflow-hidden">
        <TopBar
          isDark={isDark}
          onToggleTheme={toggleTheme}
          fileName=""
          hasPdf={false}
        >
          {onToggleSplit && (
            <SplitButton splitActive={splitActive} onClick={onToggleSplit} />
          )}
        </TopBar>
        {error && (
          <div className="bg-destructive/10 border-b border-destructive/20 text-destructive px-4 py-2 text-sm">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex-1 flex items-center justify-center bg-viewer-bg text-muted-foreground">
            Caricamento del documento…
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-thin bg-viewer-bg flex flex-col">
            <div className="min-h-[420px] flex flex-col">
              <DropZone onFile={openFile} />
            </div>
            <RecentsAndFavorites onOpen={openFile} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <TopBar isDark={isDark} onToggleTheme={toggleTheme} fileName={fileName} hasPdf>
        <div className="flex items-center gap-1">
          {onToggleSplit && (
            <>
              <SplitButton splitActive={splitActive} onClick={onToggleSplit} />
              <div className="h-6 w-px bg-border mx-1" />
            </>
          )}
          <button
            onClick={handleToggleFavorite}
            disabled={!fileId}
            title={isFav ? "Rimuovi dai preferiti" : "Aggiungi ai Preferiti"}
            className={`p-2 rounded-md hover:bg-accent text-toolbar-foreground disabled:opacity-40 ${
              isFav ? "text-yellow-500" : ""
            }`}
            aria-label={isFav ? "Rimuovi dai preferiti" : "Aggiungi ai Preferiti"}
            aria-pressed={isFav}
          >
            <Star className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
          </button>
          <div className="h-6 w-px bg-border mx-1" />
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Nascondi barra laterale" : "Mostra barra laterale"}
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground"
            aria-label="Attiva/disattiva barra laterale"
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>
          <div className="h-6 w-px bg-border mx-1" />
          <button
            onClick={handleZoomOut}
            title="Riduci zoom"
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground"
            aria-label="Riduci zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs tabular-nums text-toolbar-foreground w-12 text-center select-none">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            title="Aumenta zoom"
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground"
            aria-label="Aumenta zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleFitPage}
            title="Adatta alla pagina"
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground"
            aria-label="Adatta alla pagina"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <div className="h-6 w-px bg-border mx-1" />
          <button
            onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
            title="Pagina precedente"
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground disabled:opacity-40"
            disabled={currentPage <= 1}
            aria-label="Pagina precedente"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1 text-sm text-toolbar-foreground select-none">
            <span className="text-muted-foreground">Pagina</span>
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const n = Math.max(1, Math.min(numPages, Number(pageInput) || 1));
                  scrollToPage(n);
                }
              }}
              onBlur={() => setPageInput(String(currentPage))}
              className="w-12 h-7 text-center rounded border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Numero pagina"
            />
            <span className="text-muted-foreground">di {numPages}</span>
          </div>
          <button
            onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))}
            title="Pagina successiva"
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground disabled:opacity-40"
            disabled={currentPage >= numPages}
            aria-label="Pagina successiva"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <div className="h-6 w-px bg-border mx-1" />
          <button
            onClick={() => rotateCurrentPage(-1)}
            title="Ruota Pagina a sinistra"
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground"
            aria-label="Ruota Pagina a sinistra"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => rotateCurrentPage(1)}
            title="Ruota Pagina a destra"
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground"
            aria-label="Ruota Pagina a destra"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOrganizeMode((v) => !v)}
            title={organizeMode ? "Chiudi Organizza Pagine" : "Organizza Pagine"}
            className={`p-2 rounded-md hover:bg-accent text-toolbar-foreground ${
              organizeMode ? "bg-accent text-primary" : ""
            }`}
            aria-label="Organizza Pagine"
            aria-pressed={organizeMode}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <div className="h-6 w-px bg-border mx-1" />
          <button
            onClick={() => {
              setPanMode((v) => !v);
              setAnnTool("select");
            }}
            title={panMode ? "Strumento Mano attivo · clicca per selezionare testo (Tab, o tieni premuto Spazio)" : "Strumento Mano (Tab, o tieni premuto Spazio)"}
            className={`p-2 rounded-md hover:bg-accent text-toolbar-foreground ${
              panActive ? "bg-accent text-primary" : ""
            }`}
            aria-label="Strumento Mano"
            aria-pressed={panMode}
          >
            {panActive ? <Hand className="h-4 w-4" /> : <MousePointer2 className="h-4 w-4" />}
          </button>
          <div className="h-6 w-px bg-border mx-1" />
          {/* Annotation tools */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                setPanMode(false);
                setAnnTool((t) => (t === "highlight" ? "select" : "highlight"));
              }}
              title="Evidenziatore · seleziona del testo per evidenziarlo"
              className={`p-2 rounded-md hover:bg-accent text-toolbar-foreground ${
                annTool === "highlight" ? "bg-accent text-primary" : ""
              }`}
              aria-label="Evidenziatore"
              aria-pressed={annTool === "highlight"}
            >
              <Highlighter className="h-4 w-4" />
            </button>
            {annTool === "highlight" && (
              <div className="flex items-center gap-1 px-1">
                {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setHighlightColor(c)}
                    className={`h-4 w-4 rounded-full border transition-transform ${
                      highlightColor === c
                        ? "ring-2 ring-primary ring-offset-1 ring-offset-toolbar scale-110"
                        : "border-border hover:scale-110"
                    }`}
                    style={{ background: HIGHLIGHT_COLORS[c].css }}
                    title={
                      c === "yellow" ? "Giallo" : c === "green" ? "Verde" : "Blu"
                    }
                    aria-label={`Colore ${c}`}
                  />
                ))}
              </div>
            )}
            <button
              onClick={() => {
                setPanMode(false);
                setAnnTool((t) => (t === "note" ? "select" : "note"));
              }}
              title="Note adesive · clicca sul documento per aggiungere una nota"
              className={`p-2 rounded-md hover:bg-accent text-toolbar-foreground ${
                annTool === "note" ? "bg-accent text-primary" : ""
              }`}
              aria-label="Note adesive"
              aria-pressed={annTool === "note"}
            >
              <StickyNote className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setPanMode(false);
                setAnnTool((t) => (t === "text" ? "select" : "text"));
              }}
              title="Inserisci testo · clicca dove vuoi scrivere"
              className={`p-2 rounded-md hover:bg-accent text-toolbar-foreground ${
                annTool === "text" ? "bg-accent text-primary" : ""
              }`}
              aria-label="Inserisci testo"
              aria-pressed={annTool === "text"}
            >
              <Type className="h-4 w-4" />
            </button>
          </div>
          <div className="h-6 w-px bg-border mx-1" />
          <button
            onClick={() => setSearchOpen((v) => !v)}
            title="Cerca nel documento"
            className={`p-2 rounded-md hover:bg-accent text-toolbar-foreground ${
              searchOpen ? "bg-accent" : ""
            }`}
            aria-label="Cerca nel documento"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={handleExport}
            title={annotations.length > 0 ? "Esporta PDF con annotazioni" : "Esporta PDF (nessuna annotazione)"}
            disabled={!originalBytes || exporting}
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground disabled:opacity-40 relative"
            aria-label="Esporta PDF annotato"
          >
            <Download className="h-4 w-4" />
            {annotations.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                {annotations.length}
              </span>
            )}
          </button>
          <button
            onClick={handleSaveAs}
            title="Salva con nome"
            disabled={!originalBytes || exporting}
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground disabled:opacity-40 flex items-center gap-1.5"
            aria-label="Salva con nome"
          >
            <Save className="h-4 w-4" />
            <span className="text-xs font-medium hidden sm:inline">Salva con nome</span>
          </button>
          <div className="h-6 w-px bg-border mx-1" />
          <button
            onClick={closeFile}
            title="Chiudi file"
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground"
            aria-label="Chiudi file"
          >
            <XCircle className="h-4 w-4" />
          </button>

        </div>
      </TopBar>

      {searchOpen && (
        <div className="border-b border-border bg-toolbar px-4 py-2 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca nel documento…"
            className="flex-1 h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="p-1 rounded hover:bg-accent text-muted-foreground"
              aria-label="Cancella ricerca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
            className="text-xs px-2 py-1 rounded hover:bg-accent text-toolbar-foreground"
          >
            Chiudi
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && (
          <aside className="w-64 flex flex-col border-r border-border bg-sidebar text-sidebar-foreground">
            <div className="flex border-b border-border">
              <button
                onClick={() => setSidebarTab("thumbs")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors ${
                  sidebarTab === "thumbs"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Images className="h-4 w-4" />
                Anteprime
              </button>
              <button
                onClick={() => setSidebarTab("outline")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors ${
                  sidebarTab === "outline"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ListTree className="h-4 w-4" />
                Indice
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {sidebarTab === "thumbs" ? (
                <div className="p-3 flex flex-col gap-3">
                  {pages.map((n) => (
                    <button
                      key={n}
                      onClick={() => scrollToPage(n)}
                      className={`rounded-md p-1 transition-colors ${
                        currentPage === n ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-sidebar-hover"
                      }`}
                    >
                      <PdfThumbnail pdf={pdf} pageNumber={n} rotation={rotations[n] || 0} />
                    </button>
                  ))}
                </div>
              ) : (
                <PdfOutline pdf={pdf} onNavigate={scrollToPage} />
              )}
            </div>
          </aside>
        )}

        {organizeMode ? (
          <main className="flex-1 overflow-auto scrollbar-thin bg-viewer-bg">
            <PdfOrganizeGrid
              pdf={pdf}
              pageOrder={pages}
              rotations={rotations}
              onReorder={setPageOrder}
              onDelete={deletePage}
              onRotate={rotatePage}
            />
          </main>
        ) : (
          <main
            ref={scrollRef}
            className={`flex-1 overflow-auto scrollbar-thin bg-viewer-bg ${panActive ? "pan-mode" : ""} ${isPanning ? "panning" : ""}`}
            style={{ scrollBehavior: isPanning ? "auto" : "smooth" }}
          >
            <div className="flex flex-col items-center gap-8 py-8 px-4">
              {pages.map((n) => (
                <PdfPage
                  key={n}
                  pdf={pdf}
                  pageNumber={n}
                  scale={scale}
                  rotation={rotations[n] || 0}
                  searchQuery={searchQuery}
                  onVisible={handlePageVisible}
                  registerRef={registerPageRef}
                  tool={panActive ? "pan" : annTool}
                  highlightColor={highlightColor}
                  annotations={annotations.filter((a) => a.page === n)}
                  onAddAnnotation={addAnnotation}
                  onUpdateAnnotation={updateAnnotation}
                  onDeleteAnnotation={deleteAnnotation}
                />
              ))}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

function TopBar({
  isDark,
  onToggleTheme,
  fileName,
  hasPdf,
  children,
}: {
  isDark: boolean;
  onToggleTheme: () => void;
  fileName: string;
  hasPdf: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="h-12 flex items-center px-3 gap-3 border-b border-border bg-toolbar text-toolbar-foreground shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <div className="p-1.5 rounded-md bg-primary/10 text-primary">
          <FileText className="h-4 w-4" />
        </div>
        <span className="font-semibold text-sm">Lettore PDF</span>
        {hasPdf && fileName && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground truncate max-w-xs" title={fileName}>
              {fileName}
            </span>
          </>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center">{children}</div>
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleTheme}
          title={isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}
          className="p-2 rounded-md hover:bg-accent text-toolbar-foreground"
          aria-label="Attiva/disattiva tema scuro"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}

function SplitButton({
  splitActive,
  onClick,
}: {
  splitActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={splitActive ? "Chiudi vista affiancata" : "Apri in parallelo"}
      className={`h-8 px-2 rounded-md hover:bg-accent text-toolbar-foreground flex items-center gap-1.5 text-xs font-medium ${
        splitActive ? "bg-accent text-primary" : ""
      }`}
      aria-label={splitActive ? "Chiudi vista affiancata" : "Apri in parallelo"}
      aria-pressed={splitActive}
    >
      <Columns2 className="h-4 w-4" />
      <span className="hidden md:inline">
        {splitActive ? "Vista singola" : "Apri in parallelo"}
      </span>
    </button>
  );
}
