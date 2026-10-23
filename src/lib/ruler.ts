import type { Rect } from './bleed';
import type { Size } from './cardSize';
import { HELVETICA_CAP_HEIGHT, type HeaderPlacement } from './header';
import { mmToPt, ptToMm } from './units';

/** Barra de 50 mm a cuadros de 5 mm, de 2 mm de alto, con su rótulo en Helvetica de 6 pt. */
export const RULER_LENGTH_MM = 50;
export const RULER_HEIGHT_MM = 2;
export const RULER_STEP_MM = 5;
export const RULER_FONT_SIZE = 6;
/** El rótulo es igual en todos los idiomas. */
export const RULER_LABEL = '50 mm';
/** Hueco libre mínimo (mm) para dibujarla: la barra y 1 mm por cada lado. */
export const RULER_MIN_MM = 4;
/** Separación entre la barra y el rótulo. */
const LABEL_GAP_MM = 2;
/** Ancho aproximado del rótulo, para comprobar que cabe en la página. */
const LABEL_WIDTH_MM = 7;
/** Tolerancia al comparar huecos, para que 4 mm calculados con decimales cuenten como 4. */
const EPSILON_MM = 0.01;

export type RulerSide = 'top' | 'bottom';

/**
 * Dónde va la regla de comprobación: `x`, `y` es la esquina inferior izquierda de la barra (en
 * puntos PDF) y `label` la línea base del rótulo, a su derecha.
 */
export interface RulerPlacement {
  where: RulerSide;
  x: number;
  y: number;
  width: number;
  height: number;
  label: { x: number; y: number; size: number };
}

/**
 * Busca sitio para la regla: en el margen inferior, alineada con la primera columna, y si allí
 * no hay `RULER_MIN_MM` libres (o está la cabecera), en el superior. Las cartas y su margen de
 * corte ocupan sitio.
 */
export function rulerPlacement(
  page: Size,
  cards: Rect[],
  bleed: Rect[],
  header: HeaderPlacement | null,
): RulerPlacement | null {
  if (cards.length === 0) return null;
  const H = page.height;
  const occupied = [...cards, ...bleed];
  const free: Record<RulerSide, number> = {
    bottom: ptToMm(Math.min(...occupied.map((r) => r.y))),
    top: ptToMm(H - Math.max(...occupied.map((r) => r.y + r.height))),
  };
  const order: RulerSide[] = ['bottom', 'top'];
  const where = order.find(
    (side) => header?.where !== side && free[side] + EPSILON_MM >= RULER_MIN_MM,
  );
  if (!where) return null;

  const x = Math.min(...cards.map((r) => r.x));
  const width = mmToPt(RULER_LENGTH_MM);
  const height = mmToPt(RULER_HEIGHT_MM);
  if (x + width + mmToPt(LABEL_GAP_MM + LABEL_WIDTH_MM) > page.width) return null;
  const centre = where === 'top' ? H - mmToPt(free.top) / 2 : mmToPt(free.bottom) / 2;
  const y = centre - height / 2;
  const size = RULER_FONT_SIZE;
  return {
    where,
    x,
    y,
    width,
    height,
    label: {
      x: x + width + mmToPt(LABEL_GAP_MM),
      y: y + (height - size * HELVETICA_CAP_HEIGHT) / 2,
      size,
    },
  };
}

/** Casillas rellenas de la barra (una de cada dos, empezando por la primera). */
export function rulerCells(ruler: RulerPlacement): Rect[] {
  const step = mmToPt(RULER_STEP_MM);
  const count = Math.floor(RULER_LENGTH_MM / RULER_STEP_MM);
  return Array.from({ length: count }, (_, i) => i)
    .filter((i) => i % 2 === 0)
    .map((i) => ({ x: ruler.x + i * step, y: ruler.y, width: step, height: ruler.height }));
}
