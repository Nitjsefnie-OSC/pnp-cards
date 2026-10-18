import type { Size } from './cardSize';
import type { LayoutSettings } from './settings';
import { mmToPt } from './units';

/** Tamaños de página de iText en puntos. */
const A4: Size = { width: 595, height: 842 };
const A3: Size = { width: 842, height: 1191 };

export interface Grid {
  page: Size;
  columns: number;
  rows: number;
  perPage: number;
  /** Margen de la página en puntos. */
  margin: number;
}

/**
 * Posición del bloque de cartas, calculada con la carta de referencia (la primera del
 * documento), como en bgwPDF_DoWork.
 */
export interface Spacing {
  /** Borde izquierdo de la primera columna. */
  left: number;
  /** Distancia desde el borde superior de la página a la primera fila. */
  top: number;
  sepX: number;
  sepY: number;
}

export interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageLayout {
  page: Size;
  placements: Placement[];
}

const rotate = (s: Size): Size => ({ width: s.height, height: s.width });

export function resolveGrid(settings: LayoutSettings): Grid {
  const margin = mmToPt(settings.marginMm);
  if (settings.mode === 'vertical9') {
    return { page: A4, columns: 3, rows: 3, perPage: 9, margin };
  }
  if (settings.mode === 'template' && settings.template) {
    const { pageMm, slots } = settings.template;
    const page = { width: mmToPt(pageMm.width), height: mmToPt(pageMm.height) };
    return {
      page,
      columns: Math.max(1, slots.length),
      rows: 1,
      perPage: Math.max(1, slots.length),
      margin,
    };
  }
  if (settings.mode === 'template') {
    // Sin plantilla elegida, como la distribución por defecto.
    return { page: A4, columns: 3, rows: 3, perPage: 9, margin };
  }
  if (settings.mode === 'horizontal8') {
    return { page: rotate(A4), columns: 4, rows: 2, perPage: 8, margin };
  }
  const base =
    settings.paper === 'A3'
      ? A3
      : settings.paper === 'custom'
        ? {
            width: mmToPt(settings.customPageMm.width),
            height: mmToPt(settings.customPageMm.height),
          }
        : A4;
  const columns = Math.max(1, Math.floor(settings.columns));
  const rows = Math.max(1, Math.floor(settings.rows));
  return {
    page: settings.landscape ? rotate(base) : base,
    columns,
    rows,
    perPage: columns * rows,
    margin,
  };
}

export function computeSpacing(settings: LayoutSettings, grid: Grid, ref: Size): Spacing {
  const { page, columns, rows, margin } = grid;
  if (settings.placement === 'together') {
    return {
      left: (page.width - ref.width * columns) / 2,
      top: (page.height - ref.height * rows) / 2,
      sepX: 0,
      sepY: 0,
    };
  }
  const innerWidth = page.width - 2 * margin;
  const innerHeight = page.height - 2 * margin;
  return {
    left: margin + (columns === 1 ? (innerWidth - ref.width) / 2 : 0),
    top: margin + (rows === 1 ? (innerHeight - ref.height) / 2 : 0),
    sepX: columns > 1 ? (innerWidth - ref.width * columns) / (columns - 1) : 0,
    sepY: rows > 1 ? (innerHeight - ref.height * rows) / (rows - 1) : 0,
  };
}

/** Si la página se rellena de derecha a izquierda. */
export function isMirrored(settings: LayoutSettings) {
  return settings.rightToLeft;
}

/**
 * Coloca en una página las cartas que le tocan. Cada carta usa su propio
 * tamaño; la separación sale de la carta de referencia del documento.
 */
export function layoutPage(
  settings: LayoutSettings,
  cards: Size[],
  reference: Size = cards[0],
): PageLayout {
  const grid = resolveGrid(settings);
  const { left, top, sepX, sepY } = computeSpacing(settings, grid, reference);
  const mirrored = isMirrored(settings);

  const placements = cards.slice(0, grid.perPage).map((card, i) => {
    const posX = i % grid.columns;
    const posY = Math.floor(i / grid.columns);
    const column = mirrored ? grid.columns - posX - 1 : posX;
    return {
      x: left + (card.width + sepX) * column,
      y: grid.page.height - top - card.height - (card.height + sepY) * posY,
      width: card.width,
      height: card.height,
    };
  });

  return { page: grid.page, placements };
}
