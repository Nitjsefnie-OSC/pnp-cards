import type { Rect } from './bleed';
import type { Size } from './cardSize';
import { mmToPt, ptToMm } from './units';

/** Cuerpo de la letra de la cabecera, en puntos, y el pequeño cuando apenas hay sitio. */
export const HEADER_FONT_SIZE = 7;
export const HEADER_SMALL_FONT_SIZE = 5;
/** Hueco libre mínimo (mm) para la letra normal y para la pequeña; con menos, no se dibuja. */
export const HEADER_MIN_MM = 5;
export const HEADER_SMALL_MIN_MM = 3;
/** Separación del texto respecto al borde de las cartas, por cada extremo. */
const INSET_MM = 1.5;
/** Altura de las mayúsculas de Helvetica, como fracción del cuerpo. */
export const HELVETICA_CAP_HEIGHT = 0.718;
/** Tolerancia al comparar huecos, para que 5 mm calculados con decimales cuenten como 5. */
const EPSILON_MM = 0.01;

export type HeaderSide = 'top' | 'bottom' | 'left';

/**
 * Dónde va la cabecera de una página: el nombre empieza en `start` y el número de página
 * termina en `end` (ambos sobre la línea base, en puntos PDF). En el lateral el texto va
 * girado 90° en sentido antihorario y se lee de abajo arriba.
 */
export interface HeaderPlacement {
  where: HeaderSide;
  size: number;
  rotation: 0 | 90;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

/**
 * Busca sitio para la cabecera: arriba, si no abajo y si no en el lateral izquierdo, con la
 * letra normal donde el hueco llegue a `HEADER_MIN_MM`; si en ninguno llega, con la pequeña
 * donde haya `HEADER_SMALL_MIN_MM`. Las cartas y su margen de corte ocupan sitio; el texto se
 * alinea con las cartas.
 */
export function headerPlacement(page: Size, cards: Rect[], bleed: Rect[]): HeaderPlacement | null {
  if (cards.length === 0) return null;
  const H = page.height;
  const occupied = [...cards, ...bleed];
  const free = {
    top: ptToMm(H - Math.max(...occupied.map((r) => r.y + r.height))),
    bottom: ptToMm(Math.min(...occupied.map((r) => r.y))),
    left: ptToMm(Math.min(...occupied.map((r) => r.x))),
  };
  const fits = (side: HeaderSide, minMm: number) => free[side] + EPSILON_MM >= minMm;
  const order: HeaderSide[] = ['top', 'bottom', 'left'];
  let where = order.find((side) => fits(side, HEADER_MIN_MM));
  let size = HEADER_FONT_SIZE;
  if (!where) {
    where = order.find((side) => fits(side, HEADER_SMALL_MIN_MM));
    size = HEADER_SMALL_FONT_SIZE;
  }
  if (!where) return null;

  const inset = mmToPt(INSET_MM);
  const halfCap = (size * HELVETICA_CAP_HEIGHT) / 2;
  const left = Math.min(...cards.map((r) => r.x)) + inset;
  const right = Math.max(...cards.map((r) => r.x + r.width)) - inset;
  const bottom = Math.min(...cards.map((r) => r.y)) + inset;
  const top = Math.max(...cards.map((r) => r.y + r.height)) - inset;
  const freePt = mmToPt(free[where]);

  if (where === 'left') {
    // La mayúscula se extiende hacia la izquierda de la línea base al girar el texto.
    const x = freePt / 2 + halfCap;
    return { where, size, rotation: 90, start: { x, y: bottom }, end: { x, y: top } };
  }
  const centre = where === 'top' ? H - freePt / 2 : freePt / 2;
  const y = centre - halfCap;
  return { where, size, rotation: 0, start: { x: left, y }, end: { x: right, y } };
}
