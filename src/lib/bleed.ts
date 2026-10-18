import type { Placement } from './layout';
import type { LayoutSettings } from './settings';
import { mmToPt } from './units';

export type Rect = Placement;

/**
 * Rectángulos del margen de corte (sangrado): cuatro bandas alrededor de cada carta. Se dibujan
 * antes que las imágenes, para que queden debajo.
 */
export function bleedRects(placements: Placement[], settings: LayoutSettings): Rect[] {
  if (!settings.bleed.enabled) return [];
  const z = mmToPt(settings.bleed.mm);
  return placements.flatMap(({ x, y, width: w, height: h }) => [
    { x: x - z, y: y - z, width: z, height: h + 2 * z },
    { x: x + w, y: y - z, width: z, height: h + 2 * z },
    { x, y: y - z, width: w, height: z },
    { x, y: y + h, width: w, height: z },
  ]);
}
