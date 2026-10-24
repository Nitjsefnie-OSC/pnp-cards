import type { Dpi } from './dpi';
import type { LayoutSettings } from './settings';
import type { Rotation } from './template';
import { mmToPt } from './units';

export interface Size {
  width: number;
  height: number;
}

export interface ImageInfo {
  widthPx: number;
  heightPx: number;
  dpi: Dpi | null;
}

/** Tamaño de la carta en puntos: forzado en mm o según los ppp de la imagen (72 si no los tiene). */
export function cardSize(image: ImageInfo, settings: LayoutSettings): Size {
  const { widthPx, heightPx } = image;
  if (settings.forceWidth && settings.forceHeight) {
    return { width: mmToPt(settings.cardWidthMm), height: mmToPt(settings.cardHeightMm) };
  }
  if (settings.forceWidth) {
    const width = mmToPt(settings.cardWidthMm);
    return { width, height: (width * heightPx) / widthPx };
  }
  if (settings.forceHeight) {
    const height = mmToPt(settings.cardHeightMm);
    return { width: (height * widthPx) / heightPx, height };
  }
  const dpiX = image.dpi?.x ?? 72;
  const dpiY = image.dpi?.y ?? 72;
  return { width: (widthPx * 72) / dpiX, height: (heightPx * 72) / dpiY };
}

/**
 * La imagen tal como se coloca en la página tras girarla: un cuarto de vuelta intercambia ancho y
 * alto (y los ppp de cada eje). Con ella se calcula el hueco de una carta girada.
 */
export function rotatedImage(image: ImageInfo, rotation: Rotation): ImageInfo {
  if (rotation !== 90 && rotation !== 270) return image;
  return {
    widthPx: image.heightPx,
    heightPx: image.widthPx,
    dpi: image.dpi && { x: image.dpi.y, y: image.dpi.x },
  };
}
