// Annotation data model + helpers.
// Coordinates are stored NORMALIZED (0..1) relative to the unscaled PDF page,
// with origin at the TOP-LEFT (same convention as the DOM). Conversion to
// pdf-lib's bottom-left origin happens at export time.

export type HighlightColor = "yellow" | "green" | "blue";

export const HIGHLIGHT_COLORS: Record<HighlightColor, { css: string; rgb: [number, number, number] }> = {
  yellow: { css: "rgba(255, 235, 59, 0.45)", rgb: [1, 0.92, 0.23] },
  green: { css: "rgba(76, 217, 100, 0.45)", rgb: [0.3, 0.85, 0.39] },
  blue: { css: "rgba(64, 156, 255, 0.45)", rgb: [0.25, 0.61, 1] },
};

export type NormRect = { x: number; y: number; w: number; h: number };

export type Annotation =
  | {
      id: string;
      page: number;
      type: "highlight";
      color: HighlightColor;
      rects: NormRect[];
    }
  | {
      id: string;
      page: number;
      type: "note";
      x: number;
      y: number;
      text: string;
    }
  | {
      id: string;
      page: number;
      type: "text";
      x: number;
      y: number;
      w: number;
      text: string;
      fontSize: number; // in PDF points (unscaled)
    };

export type Tool = "select" | "pan" | "highlight" | "note" | "text";

export function newId() {
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
