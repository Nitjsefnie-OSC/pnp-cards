import { cardFit } from './cardInfo';
import { DEFAULT_SETTINGS, type LayoutSettings } from './settings';

const image = { widthPx: 744, heightPx: 1039, dpi: { x: 300, y: 300 } };
const settings = (over: Partial<LayoutSettings> = {}): LayoutSettings => ({
  ...DEFAULT_SETTINGS,
  ...over,
});

describe('cardFit', () => {
  it('calcula el tamaño físico a su resolución; sin forzar, sale igual en el PDF', () => {
    const fit = cardFit(image, settings());
    expect(fit.physicalMm.width).toBeCloseTo(62.992, 3);
    expect(fit.physicalMm.height).toBeCloseTo(87.969, 3);
    expect(fit.assumedDpi).toBe(false);
    expect(fit.result).toEqual({ kind: 'same' });
  });

  it('sin ppp en la imagen, supone 72', () => {
    const fit = cardFit({ ...image, dpi: null }, settings());
    expect(fit.assumedDpi).toBe(true);
    expect(fit.physicalMm.width).toBeCloseTo(262.467, 3);
  });

  it('con tamaño forzado, dice cuánto se escala', () => {
    const fit = cardFit(
      image,
      settings({ forceWidth: true, forceHeight: true, cardWidthMm: 69.3, cardHeightMm: 96.8 }),
    );
    expect(fit.result).toMatchObject({ kind: 'scaled' });
    if (fit.result.kind !== 'scaled') throw new Error();
    expect(fit.result.percent).toBe(110);
    expect(fit.result.printedMm.width).toBeCloseTo(69.3, 3);
  });

  it('si el ancho y el alto se escalan distinto, la carta se deforma', () => {
    const fit = cardFit(
      image,
      settings({ forceWidth: true, forceHeight: true, cardWidthMm: 63, cardHeightMm: 100 }),
    );
    expect(fit.result).toMatchObject({ kind: 'distorted', percentX: 100, percentY: 114 });
  });

  it('con recorte, dice a qué tamaño se recorta', () => {
    const fit = cardFit(
      image,
      settings({ crop: { enabled: true, widthMm: 60, heightMm: 85, centered: true, x: 0, y: 0 } }),
    );
    expect(fit.result).toMatchObject({ kind: 'cropped' });
    if (fit.result.kind !== 'cropped') throw new Error();
    expect(fit.result.cropMm.width).toBeCloseTo(60, 0);
  });

  it('con plantilla, el tamaño depende del hueco', () => {
    expect(cardFit(image, settings({ mode: 'template' })).result).toEqual({ kind: 'slot' });
  });
});
