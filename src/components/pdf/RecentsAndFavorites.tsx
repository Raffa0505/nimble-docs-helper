import { useEffect, useState } from "react";
import { Clock, Star, Trash2, FileText } from "lucide-react";
import {
  getEntries,
  loadFile,
  onLibraryChange,
  removeEntry,
  type LibraryEntry,
} from "@/lib/pdf-library";

export function RecentsAndFavorites({ onOpen }: { onOpen: (file: File) => void }) {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setEntries(getEntries());
    refresh();
    return onLibraryChange(refresh);
  }, []);

  const favorites = entries
    .filter((e) => e.favorite)
    .sort((a, b) => b.lastOpened - a.lastOpened);
  const recents = [...entries]
    .sort((a, b) => b.lastOpened - a.lastOpened)
    .slice(0, 10);

  const handleOpen = async (id: string) => {
    setLoadingId(id);
    try {
      const file = await loadFile(id);
      if (file) onOpen(file);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-8 grid gap-6 md:grid-cols-2">
      <Section title="Documenti Recenti" icon={<Clock className="h-4 w-4" />}>
        {recents.length === 0 ? (
          <Empty text="Nessun documento recente. Apri un PDF per iniziare." />
        ) : (
          recents.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              loading={loadingId === e.id}
              onOpen={handleOpen}
              onRemove={(id) => removeEntry(id)}
            />
          ))
        )}
      </Section>
      <Section title="Preferiti" icon={<Star className="h-4 w-4 fill-current" />}>
        {favorites.length === 0 ? (
          <Empty text='Nessun preferito. Apri un PDF e tocca "Aggiungi ai Preferiti".' />
        ) : (
          favorites.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              loading={loadingId === e.id}
              onOpen={handleOpen}
              onRemove={(id) => removeEntry(id)}
            />
          ))
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground py-2">{text}</div>;
}

function EntryRow({
  entry,
  loading,
  onOpen,
  onRemove,
}: {
  entry: LibraryEntry;
  loading: boolean;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="group flex items-center gap-2 rounded-md hover:bg-accent px-2 py-1.5 transition-colors">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <button
        onClick={() => onOpen(entry.id)}
        disabled={loading}
        className="flex-1 min-w-0 text-left disabled:opacity-60"
        title={entry.name}
      >
        <div className="truncate text-sm text-foreground">{entry.name}</div>
        <div className="text-[11px] text-muted-foreground">
          {formatDate(entry.lastOpened)} · {formatSize(entry.size)}
          {loading ? " · caricamento…" : ""}
        </div>
      </button>
      <button
        onClick={() => onRemove(entry.id)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity"
        aria-label="Rimuovi"
        title="Rimuovi dalla libreria"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function formatDate(t: number) {
  const d = new Date(t);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) {
    return `Oggi, ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
