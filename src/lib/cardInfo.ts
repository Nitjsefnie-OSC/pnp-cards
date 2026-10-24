import { cardSize, type ImageInfo } from './cardSize';
import { CROP_DPI, cropRect } from './crop';
import type { LayoutSettings } from './settings';
import { slotLocalSize } from './template';
import { ptToMm, pxToMm } from './units';

type Mm = { width: number; height: number };

/** Cómo sale la imagen en el PDF comparada con su tamaño físico. */
export type FitResult =
  | { kind: 'same' }
  | { kind: 'scaled'; percent: number; printedMm: Mm }
  | { kind: 'distorted'; percentX: number; percentY: number; printedMm: Mm }
  | { kind: 'cropped'; cropMm: Mm }
  /** Con plantilla, cada copia mide lo que su hueco. */
  | { kind: 'slot' };

export interface CardFit {
  /** Tamaño a su resolución (72 ppp si la imagen no la indica). */
  physicalMm: Mm;
  assumedDpi: boolean;
  result: FitResult;
}

/** Diferencias de menos del 0,5 % se consideran el mismo tamaño. */
const TOLERANCE = 0.005;

export function cardFit(image: ImageInfo, settings: LayoutSettings): CardFit {
  const dpi = image.dpi ?? { x: 72, y: 72 };
  const physicalMm = { width: pxToMm(image.widthPx, dpi.x), height: pxToMm(image.heightPx, dpi.y) };
  const base = { physicalMm, assumedDpi: !image.dpi };

  if (settings.mode === 'template') return { ...base, result: { kind: 'slot' } };
  if (settings.crop.enabled) {
    const crop = cropRect(image, settings.crop);
    return {
      ...base,
      result: {
        kind: 'cropped',
        cropMm: { width: pxToMm(crop.width, CROP_DPI), height: pxToMm(crop.height, CROP_DPI) },
      },
    };
  }

  const printed = cardSize(image, settings);
  const printedMm = { width: ptToMm(printed.width), height: ptToMm(printed.height) };
  const rx = printedMm.width / physicalMm.width;
  const ry = printedMm.height / physicalMm.height;
  if (Math.abs(rx - 1) < TOLERANCE && Math.abs(ry - 1) < TOLERANCE) {
    return { ...base, result: { kind: 'same' } };
  }
  const percentX = Math.round(rx * 100);
  const percentY = Math.round(ry * 100);
  return {
    ...base,
    result:
      percentX === percentY
        ? { kind: 'scaled', percent: percentX, printedMm }
        : { kind: 'distorted', percentX, percentY, printedMm },
  };
}

/** Por debajo de estos ppp al imprimir, la carta puede verse borrosa (lo que piden las imprentas). */
export const MIN_PRINT_DPI = 300;

/** Si el tamaño de la carta no sale de los ppp de la imagen: forzado, recortado o de una plantilla. */
export function fixedSize(settings: LayoutSettings) {
  return (
    settings.forceWidth ||
    settings.forceHeight ||
    settings.crop.enabled ||
    settings.mode === 'template'
  );
}

/**
 * Ppp con los que saldrá impresa la carta: los píxeles visibles (los del recorte, si lo hay) entre
 * su tamaño final en pulgadas, en el eje que peor queda. Sin forzar ni recortar coinciden con los
 * de la imagen (72 si no los indica). Con plantilla manda el hueco más grande, que es el peor
 * caso; null si no hay plantilla.
 */
export function printedDpi(image: ImageInfo, settings: LayoutSettings): number | null {
  const crop = settings.crop.enabled ? cropRect(image, settings.crop) : null;
  const visible: ImageInfo = crop
    ? { widthPx: crop.width, heightPx: crop.height, dpi: { x: CROP_DPI, y: CROP_DPI } }
    : image;
  const dpiFor = (widthMm: number, heightMm: number) =>
    Math.round(Math.min(visible.widthPx / (widthMm / 25.4), visible.heightPx / (heightMm / 25.4)));

  if (settings.mode === 'template') {
    const slots = settings.template?.slots ?? [];
    if (slots.length === 0) return null;
    return Math.min(
      ...slots.map((slot) => {
        const box = { x: 0, y: 0, width: slot.widthMm, height: slot.heightMm };
        const local = slotLocalSize(box, slot.rotation);
        return dpiFor(local.width, local.height);
      }),
    );
  }
  const printed = cardSize(visible, settings);
  return dpiFor(ptToMm(printed.width), ptToMm(printed.height));
}

/**
 * Si la carta saldrá con menos de MIN_PRINT_DPI. Una imagen sin ppp a su tamaño «natural» (72 ppp)
 * ya tiene su propio aviso, así que solo cuenta cuando se fija el tamaño.
 */
export function lowResolution(image: ImageInfo, settings: LayoutSettings) {
  if (!image.dpi && !fixedSize(settings)) return false;
  const dpi = printedDpi(image, settings);
  return dpi !== null && dpi < MIN_PRINT_DPI;
}

export interface CardSizeSummary {
  /** Tamaño con el que saldrá la primera carta. */
  firstMm: Mm;
  /** Cuántas de las demás saldrán con otro tamaño (más del 0,5 % de diferencia). */
  differentCount: number;
}

/**
 * Tamaño resultante de las cartas cuando lo decide la imagen (o el recorte), para mostrarlo en
 * Ajustes: el de la primera y cuántas difieren. Mismo cálculo que `cardSizes` en `plan.ts`. Null
 * sin cartas, con ancho y alto forzados (el tamaño ya está en el desplegable) o con plantilla
 * (manda el hueco).
 */
export function cardSizeSummary(
  images: ImageInfo[],
  settings: LayoutSettings,
): CardSizeSummary | null {
  if (images.length === 0) return null;
  if (settings.mode === 'template') return null;
  if (settings.forceWidth && settings.forceHeight) return null;

  const sizes = images.map((image) => {
    const crop = settings.crop.enabled ? cropRect(image, settings.crop) : null;
    const pt = crop
      ? cardSize(
          { widthPx: crop.width, heightPx: crop.height, dpi: { x: CROP_DPI, y: CROP_DPI } },
          settings,
        )
      : cardSize(image, settings);
    return { width: ptToMm(pt.width), height: ptToMm(pt.height) };
  });
  const [first, ...rest] = sizes;
  const differs = (a: number, b: number) => Math.abs(a / b - 1) >= TOLERANCE;
  const differentCount = rest.filter(
    (s) => differs(s.width, first.width) || differs(s.height, first.height),
  ).length;
  return { firstMm: first, differentCount };
}
