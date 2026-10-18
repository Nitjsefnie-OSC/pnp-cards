import { cardSize, type ImageInfo } from './cardSize';
import { CROP_DPI, cropRect } from './crop';
import type { LayoutSettings } from './settings';
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
