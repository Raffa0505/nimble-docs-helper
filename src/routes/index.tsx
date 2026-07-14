import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";

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

function Index() {
  const [split, setSplit] = useState(false);
  const toggleSplit = () => setSplit((s) => !s);

  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-viewer-bg text-muted-foreground">
          Caricamento…
        </div>
      }
    >
      <div className={`h-screen w-screen flex ${split ? "flex-row" : ""} overflow-hidden`}>
        <div className={split ? "w-1/2 h-full border-r border-border" : "w-full h-full"}>
          <PdfViewer onToggleSplit={toggleSplit} splitActive={split} />
        </div>
        {split && (
          <div className="w-1/2 h-full">
            <PdfViewer onToggleSplit={toggleSplit} splitActive={split} />
          </div>
        )}
      </div>
    </Suspense>
  );
}
