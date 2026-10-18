import type { Size } from './cardSize';
import { computeSpacing, resolveGrid } from './layout';
import type { LayoutSettings } from './settings';
import { mmToPt } from './units';

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CutLines {
  /** Grosor en puntos. */
  lineWidth: number;
  segments: Segment[];
}

/** Hueco entre las marcas normales y la carta, y largo de los brazos de las cruces (en pt). */
const LINE_GAP = 1;
const CROSS_ARM = 5;

/**
 * Líneas de corte de una página, como en bgwPDF_DoWork: se trazan para toda la rejilla con el
 * tamaño de la primera carta de la página y la posición calculada con la carta de referencia.
 */
export function cutLines(
  settings: LayoutSettings,
  pageCard: Size,
  reference: Size,
): CutLines | null {
  const { enabled, style, widthHundredthsMm } = settings.cutLines;
  if (!enabled) return null;

  const grid = resolveGrid(settings);
  const { left: L, top: T, sepX, sepY } = computeSpacing(settings, grid, reference);
  const { width: W, height: H } = grid.page;
  const { width: w, height: h } = pageCard;
  const segments: Segment[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    segments.push({ x1, y1, x2, y2 });

  for (let m = 0; m < grid.columns; m++) {
    for (const x of [L + (w + sepX) * m, L + w + (w + sepX) * m]) {
      if (style === 'normal') {
        line(x, H, x, H - T + LINE_GAP);
        line(x, T - LINE_GAP, x, 0);
      } else if (style === 'full') {
        line(x, H, x, 0);
      } else {
        line(x, H, x, H - T - CROSS_ARM);
        line(x, T + CROSS_ARM, x, 0);
      }
    }
    if (style === 'cross') {
      for (let n = 1; n < grid.rows; n++) {
        for (const y of [T + h * n + sepY * (n - 1), T + (h + sepY) * n]) {
          for (const x of [L + (w + sepX) * m, L + w + (w + sepX) * m]) {
            line(x, y - CROSS_ARM, x, y + CROSS_ARM);
          }
        }
      }
    }
  }

  for (let m = 0; m < grid.rows; m++) {
    for (const y of [H - T - (h + sepY) * m, H - T - h - (h + sepY) * m]) {
      if (style === 'normal') {
        line(0, y, L - LINE_GAP, y);
        line(W - L + LINE_GAP, y, W, y);
      } else if (style === 'full') {
        line(0, y, W, y);
      } else {
        line(0, y, L + CROSS_ARM, y);
        line(W - L - CROSS_ARM, y, W, y);
      }
    }
    if (style === 'cross') {
      for (let n = 1; n < grid.columns; n++) {
        for (const x of [L + w * n + sepX * (n - 1), L + (w + sepX) * n]) {
          for (const y of [H - T - (h + sepY) * m, H - T - h - (h + sepY) * m]) {
            line(x - CROSS_ARM, y, x + CROSS_ARM, y);
          }
        }
      }
    }
  }

  return { lineWidth: mmToPt(widthHundredthsMm / 100), segments };
}
