import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useState } from "react";
import { TabsBar, type PdfTab } from "@/components/pdf/TabsBar";
import { DropZone } from "@/components/pdf/DropZone";
import { RecentsAndFavorites } from "@/components/pdf/RecentsAndFavorites";

const PdfViewer = lazy(() =>
  import("@/components/pdf/PdfViewer").then((m) => ({ default: m.PdfViewer })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lettore PDF" },
      {
        name: "description",
        content:
          "Lettore PDF moderno, ultra-veloce e fluido. Anteprime, indice, ricerca e modalità scura. I file rimangono sul tuo dispositivo.",
      },
      { property: "og:title", content: "Lettore PDF" },
      {
        property: "og:description",
        content:
          "Lettore PDF moderno, ultra-veloce e fluido. Anteprime, indice, ricerca e modalità scura. I file rimangono sul tuo dispositivo.",
      },
    ],
  }),
  component: Index,
});

type OpenTab = PdfTab & { file: File };

function Index() {
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const openFile = useCallback((file: File) => {
    const id = `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    setTabs((prev) => [...prev, { id, name: file.name, file }]);
    setActiveId(id);
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx === -1) return prev;
        const next = prev.filter((t) => t.id !== id);
        if (activeId === id) {
          const neighbor = next[idx] || next[idx - 1] || null;
          setActiveId(neighbor ? neighbor.id : null);
        }
        return next;
      });
    },
    [activeId],
  );

  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-viewer-bg text-muted-foreground">
          Caricamento…
        </div>
      }
    >
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
        {tabs.length > 0 && (
          <TabsBar
            tabs={tabs.map(({ id, name }) => ({ id, name }))}
            activeId={activeId}
            onSelect={setActiveId}
            onClose={closeTab}
            onNewFile={openFile}
          />
        )}
        <div className="flex-1 min-h-0 relative">
          {tabs.length === 0 ? (
            <div className="h-full overflow-y-auto scrollbar-thin bg-viewer-bg flex flex-col">
              <div className="min-h-[420px] flex flex-col">
                <DropZone onFile={openFile} />
              </div>
              <RecentsAndFavorites onOpen={openFile} />
            </div>
          ) : (
            tabs.map((t) => (
              <div
                key={t.id}
                className="absolute inset-0"
                style={{ display: t.id === activeId ? "block" : "none" }}
              >
                <PdfViewer initialFile={t.file} />
              </div>
            ))
          )}
        </div>
      </div>
    </Suspense>
  );
}
