import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import type { Annotation } from "./annotations";
import { HIGHLIGHT_COLORS } from "./annotations";

export async function exportAnnotatedPdf(
  originalBytes: ArrayBuffer,
  annotations: Annotation[],
  fileName: string,
  options?: {
    pageOrder?: number[]; // 1-based original page numbers, in output order
    rotations?: Record<number, number>; // by original 1-based page number
  },
): Promise<void> {
  const src = await PDFDocument.load(originalBytes);
  const font = await src.embedFont(StandardFonts.Helvetica);
  const srcPages = src.getPages();

  // Draw annotations onto the source doc first so copyPages carries them.
  for (const ann of annotations) {
    const page = srcPages[ann.page - 1];
    if (!page) continue;
    const { width: pw, height: ph } = page.getSize();

    if (ann.type === "highlight") {
      const color = HIGHLIGHT_COLORS[ann.color].rgb;
      for (const r of ann.rects) {
        page.drawRectangle({
          x: r.x * pw,
          y: ph - (r.y + r.h) * ph,
          width: r.w * pw,
          height: r.h * ph,
          color: rgb(color[0], color[1], color[2]),
          opacity: 0.4,
        });
      }
    } else if (ann.type === "text") {
      const fs = ann.fontSize;
      const lines = wrapText(ann.text, font, fs, ann.w * pw);
      let yTop = ann.y * ph;
      for (const line of lines) {
        yTop += fs * 1.2;
        page.drawText(line, {
          x: ann.x * pw,
          y: ph - yTop,
          size: fs,
          font,
          color: rgb(0, 0, 0),
        });
      }
    } else if (ann.type === "note") {
      const x = ann.x * pw;
      const y = ph - ann.y * ph;
      page.drawRectangle({
        x,
        y: y - 14,
        width: 14,
        height: 14,
        color: rgb(1, 0.85, 0.2),
        borderColor: rgb(0.6, 0.45, 0),
        borderWidth: 0.5,
      });
      const fs = 9;
      const lines = wrapText(ann.text || "(nota)", font, fs, 180);
      let ly = y - 2;
      for (const line of lines) {
        page.drawText(line, {
          x: x + 18,
          y: ly - fs,
          size: fs,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
        ly -= fs * 1.25;
      }
    }
  }

  const order = options?.pageOrder ?? srcPages.map((_, i) => i + 1);
  const rotations = options?.rotations ?? {};
  const needsRebuild =
    options?.pageOrder !== undefined ||
    Object.values(rotations).some((r) => (r || 0) % 360 !== 0);

  let outBytes: Uint8Array;
  if (needsRebuild) {
    const out = await PDFDocument.create();
    const indices = order.map((p) => p - 1).filter((i) => i >= 0 && i < srcPages.length);
    const copied = await out.copyPages(src, indices);
    copied.forEach((page, i) => {
      const originalPage = order[i];
      const existing = page.getRotation().angle || 0;
      const extra = ((rotations[originalPage] || 0) % 360 + 360) % 360;
      if (extra) page.setRotation(degrees((existing + extra) % 360));
      out.addPage(page);
    });
    outBytes = await out.save();
  } else {
    outBytes = await src.save();
  }

  const outCopy = new Uint8Array(outBytes.byteLength);
  outCopy.set(outBytes);
  const blob = new Blob([outCopy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const base = fileName.replace(/\.pdf$/i, "") || "documento";
  a.href = url;
  a.download = `${base}-annotato.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const paragraphs = text.split(/\n/);
  const out: string[] = [];
  for (const p of paragraphs) {
    if (!p) {
      out.push("");
      continue;
    }
    const words = p.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        line = test;
      } else {
        if (line) out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
  }
  return out;
}
