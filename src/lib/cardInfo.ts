import { cardSize, rotatedImage, type ImageInfo } from './cardSize';
import { CROP_DPI, cropRect } from './crop';
import { cardRotations, slotRotation } from './rotation';
import type { LayoutSettings } from './settings';
import { slotLocalSize, type Rotation } from './template';
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

/**
 * Cómo sale la carta en el PDF. `rotation` es su giro en la página (elegido o automático): el
 * tamaño impreso se compara con el físico ya girado.
 */
export function cardFit(
  image: ImageInfo,
  settings: LayoutSettings,
  rotation: Rotation = 0,
): CardFit {
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

  const placed = rotatedImage(image, rotation);
  const placedDpi = placed.dpi ?? { x: 72, y: 72 };
  const placedMm = {
    width: pxToMm(placed.widthPx, placedDpi.x),
    height: pxToMm(placed.heightPx, placedDpi.y),
  };
  const printed = cardSize(placed, settings);
  const printedMm = { width: ptToMm(printed.width), height: ptToMm(printed.height) };
  const rx = printedMm.width / placedMm.width;
  const ry = printedMm.height / placedMm.height;
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
 * Lo que se ve de la imagen: con recorte, el rectángulo recortado a 300 ppp (como en PDFCartas y
 * en `cardSizes` de plan.ts); si no, la imagen entera.
 */
function visibleImage(image: ImageInfo, settings: LayoutSettings): ImageInfo {
  if (!settings.crop.enabled) return image;
  const crop = cropRect(image, settings.crop);
  return { widthPx: crop.width, heightPx: crop.height, dpi: { x: CROP_DPI, y: CROP_DPI } };
}

/**
 * Ppp con los que saldrá impresa la carta: los píxeles visibles (los del recorte, si lo hay) entre
 * su tamaño final en pulgadas, en el eje que peor queda. Sin forzar ni recortar coinciden con los
 * de la imagen (72 si no los indica). Con plantilla manda el hueco más grande, que es el peor
 * caso; null si no hay plantilla. `rotation` es el giro de la carta en la página (en cuadrícula,
 * el elegido o el automático; con plantilla, el elegido: el automático se decide en cada hueco).
 */
export function printedDpi(
  image: ImageInfo,
  settings: LayoutSettings,
  rotation: Rotation = 0,
): number | null {
  const visible = visibleImage(image, settings);
  const dpiFor = (placed: ImageInfo, widthMm: number, heightMm: number) =>
    Math.round(Math.min(placed.widthPx / (widthMm / 25.4), placed.heightPx / (heightMm / 25.4)));

  if (settings.mode === 'template') {
    const slots = settings.template?.slots ?? [];
    if (slots.length === 0) return null;
    const card = { ...image, copies: 1, blank: false, rotation };
    return Math.min(
      ...slots.map((slot) => {
        const box = { x: 0, y: 0, width: slot.widthMm, height: slot.heightMm };
        const local = slotLocalSize(box, slot.rotation);
        const crop = settings.crop.enabled ? cropRect(image, settings.crop) : null;
        const placed = rotatedImage(visible, slotRotation(settings, card, crop, local));
        return dpiFor(placed, local.width, local.height);
      }),
    );
  }
  const placed = rotatedImage(visible, rotation);
  const printed = cardSize(placed, settings);
  return dpiFor(placed, ptToMm(printed.width), ptToMm(printed.height));
}

/**
 * Si la carta saldrá con menos de MIN_PRINT_DPI. Una imagen sin ppp a su tamaño «natural» (72 ppp)
 * ya tiene su propio aviso, así que solo cuenta cuando se fija el tamaño.
 */
export function lowResolution(image: ImageInfo, settings: LayoutSettings, rotation: Rotation = 0) {
  if (!image.dpi && !fixedSize(settings)) return false;
  const dpi = printedDpi(image, settings, rotation);
  return dpi !== null && dpi < MIN_PRINT_DPI;
}

export interface CardSizeSummary {
  /** Tamaño con el que saldrá la primera carta. */
  firstMm: Mm;
  /** Cuántas cartas (contando copias) saldrán con otro tamaño: más del 0,5 % de diferencia. */
  differentCount: number;
}

/**
 * Tamaño resultante de las cartas cuando lo decide la imagen (o el recorte), para mostrarlo en
 * Ajustes: el de la primera y cuántas difieren, contando cada carta ya girada. Null sin cartas,
 * con algún lado forzado (ese caso lo explica ya el desplegable) o con plantilla (manda el hueco).
 */
export function cardSizeSummary(
  images: (ImageInfo & { copies?: number; rotation?: Rotation })[],
  settings: LayoutSettings,
): CardSizeSummary | null {
  if (images.length === 0) return null;
  if (settings.mode === 'template') return null;
  if (settings.forceWidth || settings.forceHeight) return null;

  const cards = images.map((image) => ({ ...image, copies: image.copies ?? 1, blank: false }));
  const crops = images.map((image) =>
    settings.crop.enabled ? cropRect(image, settings.crop) : null,
  );
  const rotations = cardRotations(settings, cards, crops);
  const sizes = images.map((image, i) => {
    const pt = cardSize(rotatedImage(visibleImage(image, settings), rotations[i]), settings);
    return { width: ptToMm(pt.width), height: ptToMm(pt.height), copies: image.copies ?? 1 };
  });
  const [first, ...rest] = sizes;
  const differs = (a: number, b: number) => Math.abs(a / b - 1) >= TOLERANCE;
  const differentCount = rest
    .filter((s) => differs(s.width, first.width) || differs(s.height, first.height))
    .reduce((n, s) => n + s.copies, 0);
  return { firstMm: { width: first.width, height: first.height }, differentCount };
}
