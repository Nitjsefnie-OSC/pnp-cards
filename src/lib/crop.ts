import type { Placement } from './layout';
import type { CropSettings } from './settings';
import { mmToPx } from './units';

export interface PxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Ppp a los que se interpreta el tamaño del recorte en mm, como en PDFCartas. */
export const CROP_DPI = 300;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Parte central de la imagen con la forma `aspect` (ancho / alto): la que llena un hueco de esa
 * forma sin deformarse.
 */
export function coverCrop(image: { widthPx: number; heightPx: number }, aspect: number): PxRect {
  const { widthPx: W, heightPx: H } = image;
  const width = W / H > aspect ? Math.round(H * aspect) : W;
  const height = W / H > aspect ? H : Math.round(W / aspect);
  return { x: Math.round((W - width) / 2), y: Math.round((H - height) / 2), width, height };
}

/**
 * Rectángulo de recorte en píxeles (origen arriba a la izquierda). Un tamaño de 0 mm deja la
 * dimensión entera; si el recorte no cabe, se ajusta a la imagen y `clamped` es true.
 */
export function cropRect(
  image: { widthPx: number; heightPx: number },
  crop: CropSettings,
): PxRect & { clamped: boolean } {
  const { widthPx: W, heightPx: H } = image;
  const wantW = crop.widthMm > 0 ? mmToPx(crop.widthMm, CROP_DPI) : W;
  const wantH = crop.heightMm > 0 ? mmToPx(crop.heightMm, CROP_DPI) : H;
  const width = Math.min(wantW, W);
  const height = Math.min(wantH, H);

  const wantX = crop.centered ? Math.round((W - width) / 2) : crop.x;
  const wantY = crop.centered ? Math.round((H - height) / 2) : crop.y;
  const x = clamp(wantX, 0, W - width);
  const y = clamp(wantY, 0, H - height);

  const clamped = width !== wantW || height !== wantH || x !== wantX || y !== wantY;
  return { x, y, width, height, clamped };
}

/**
 * Dónde dibujar la imagen completa (en puntos PDF) para que el recorte ocupe exactamente el
 * hueco de la carta; lo que sobra se oculta con una máscara de recorte del tamaño del hueco.
 */
export function imageDrawRect(
  placement: Placement,
  crop: PxRect,
  image: { widthPx: number; heightPx: number },
): Placement {
  const sx = placement.width / crop.width;
  const sy = placement.height / crop.height;
  const below = image.heightPx - crop.y - crop.height;
  return {
    x: placement.x - crop.x * sx,
    y: placement.y - below * sy,
    width: image.widthPx * sx,
    height: image.heightPx * sy,
  };
}
