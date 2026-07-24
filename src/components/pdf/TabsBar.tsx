import { Plus, X, FileText } from "lucide-react";
import { useRef } from "react";

export type PdfTab = {
  id: string;
  name: string;
};

interface Props {
  tabs: PdfTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNewFile: (file: File) => void;
}

export function TabsBar({ tabs, activeId, onSelect, onClose, onNewFile }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        onNewFile(file);
      }
    }
    e.target.value = "";
  };

  return (
    <div className="h-9 flex items-end bg-background border-b border-border shrink-0 overflow-hidden">
      <div className="flex-1 flex items-end gap-0.5 px-2 overflow-x-auto scrollbar-thin">
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <div
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`group h-8 flex items-center gap-2 px-3 pr-1.5 min-w-0 max-w-[220px] rounded-t-md cursor-pointer border border-b-0 transition-colors ${
                active
                  ? "bg-toolbar border-border text-toolbar-foreground"
                  : "bg-background/40 border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
              title={t.name}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="text-xs truncate min-w-0 flex-1">{t.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(t.id);
                }}
                className={`p-0.5 rounded hover:bg-destructive/20 hover:text-destructive shrink-0 ${
                  active ? "opacity-70" : "opacity-0 group-hover:opacity-70"
                }`}
                aria-label={`Chiudi ${t.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {active && (
                <span
                  className="absolute pointer-events-none"
                  aria-hidden
                />
              )}
            </div>
          );
        })}
        <button
          onClick={() => inputRef.current?.click()}
          className="h-8 w-8 flex items-center justify-center rounded-t-md text-muted-foreground hover:bg-accent hover:text-foreground shrink-0"
          title="Apri nuovo PDF"
          aria-label="Apri nuovo PDF"
        >
          <Plus className="h-4 w-4" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={handlePick}
        />
      </div>
    </div>
  );
}
