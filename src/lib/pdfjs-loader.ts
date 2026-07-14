// Client-only pdf.js loader. Guarded for SSR.
import type * as PdfjsType from "pdfjs-dist";

let pdfjsPromise: Promise<typeof PdfjsType> | null = null;

export function loadPdfjs(): Promise<typeof PdfjsType> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("pdf.js can only be loaded in the browser"));
  }
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}
