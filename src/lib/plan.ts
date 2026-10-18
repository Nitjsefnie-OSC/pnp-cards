import { bleedRects, type Rect } from './bleed';
import { cardSize, type Size } from './cardSize';
import { cutLines, type CutLines } from './cutLines';
import type { Dpi } from './dpi';
import { layoutPage, resolveGrid, type Placement } from './layout';
import type { LayoutSettings } from './settings';

export interface CardSpec {
  widthPx: number;
  heightPx: number;
  dpi: Dpi | null;
  blank: boolean;
  copies: number;
}

export interface PlannedItem {
  /** Índice de la carta en la lista recibida. */
  card: number;
  placement: Placement;
}

export interface PlannedPage {
  /** Número de página, desde 1. */
  number: number;
  size: Size;
  items: PlannedItem[];
  bleed: Rect[];
  cutLines: CutLines | null;
}

export interface DocumentPlan {
  pages: PlannedPage[];
  total: number;
}

export type PlanErrorCode = 'empty' | 'blank-without-size';

export class PlanError extends Error {
  constructor(readonly code: PlanErrorCode) {
    super(code);
    this.name = 'PlanError';
  }
}

/**
 * Tamaño en puntos de cada carta. Una imagen en blanco toma el de la carta anterior (o el de
 * la siguiente si va la primera), salvo que se fuercen ancho y alto.
 */
function cardSizes(settings: LayoutSettings, cards: CardSpec[]): Size[] {
  const own = cards.map((c) => (c.blank ? null : cardSize(c, settings)));
  const forcedBoth = settings.forceWidth && settings.forceHeight;
  return own.map((size, i) => {
    if (size) return size;
    if (forcedBoth) return cardSize({ widthPx: 1, heightPx: 1, dpi: null }, settings);
    const previous = own.slice(0, i).findLast((s) => s !== null);
    const next = own.slice(i + 1).find((s) => s !== null);
    const neighbour = previous ?? next;
    if (!neighbour) throw new PlanError('blank-without-size');
    return neighbour;
  });
}

/** Plan completo del PDF: qué carta va en cada hueco de cada página, con sus cortes. */
export function planDocument(settings: LayoutSettings, cards: CardSpec[]): DocumentPlan {
  const sequence = cards.flatMap((c, i) => Array.from({ length: Math.max(0, c.copies) }, () => i));
  if (sequence.length === 0) throw new PlanError('empty');

  const sizes = cardSizes(settings, cards);
  const { perPage } = resolveGrid(settings);
  const reference = sizes[sequence[0]];

  const pages: PlannedPage[] = [];
  for (let start = 0; start < sequence.length; start += perPage) {
    const number = pages.length + 1;
    const pageCards = sequence.slice(start, start + perPage);
    const pageSizes = pageCards.map((i) => sizes[i]);
    const { page, placements } = layoutPage(settings, pageSizes, number, reference);
    pages.push({
      number,
      size: page,
      items: pageCards.map((card, i) => ({ card, placement: placements[i] })),
      bleed: bleedRects(placements, settings),
      cutLines: cutLines(settings, pageSizes[0], reference),
    });
  }

  return { pages, total: sequence.length };
}
