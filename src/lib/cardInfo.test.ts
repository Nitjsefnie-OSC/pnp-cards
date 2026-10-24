import { cardFit, cardSizeSummary, lowResolution, MIN_PRINT_DPI, printedDpi } from './cardInfo';
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

describe('printedDpi', () => {
  it('sin forzar ni recortar, son los ppp de la imagen', () => {
    expect(printedDpi(image, settings())).toBe(300);
    expect(printedDpi({ ...image, dpi: { x: 150, y: 150 } }, settings())).toBe(150);
  });

  it('sin ppp en la imagen, sale a 72', () => {
    expect(printedDpi({ ...image, dpi: null }, settings())).toBe(72);
  });

  it('con tamaño forzado, divide los píxeles entre el tamaño final y da el menor eje', () => {
    // 750 / (63 / 25,4) = 302,4; 1050 / (88 / 25,4) = 303,1.
    const forced = settings({
      forceWidth: true,
      forceHeight: true,
      cardWidthMm: 63,
      cardHeightMm: 88,
    });
    expect(printedDpi({ widthPx: 750, heightPx: 1050, dpi: { x: 300, y: 300 } }, forced)).toBe(302);
    // 400 / 2,4803 = 161,3; 560 / 3,4646 = 161,6.
    expect(printedDpi({ widthPx: 400, heightPx: 560, dpi: null }, forced)).toBe(161);
  });

  it('forzando solo el ancho, el alto va en proporción', () => {
    // 744 / 2,4803 = 300,0; alto 63 × 1039 / 744 = 87,98 mm → 1039 / 3,4638 = 300,0.
    expect(
      printedDpi({ ...image, dpi: null }, settings({ forceWidth: true, cardWidthMm: 63 })),
    ).toBe(300);
  });

  it('con recorte cuentan solo sus píxeles, y sale a 300 ppp salvo que se fuerce', () => {
    const crop = { enabled: true, widthMm: 60, heightMm: 85, centered: true, x: 0, y: 0 };
    expect(printedDpi(image, settings({ crop }))).toBe(300);
    // Recorte de 709 × 1004 px forzado a 63 × 88 mm: 709 / 2,4803 = 285,9; 1004 / 3,4646 = 289,8.
    expect(
      printedDpi(
        image,
        settings({ crop, forceWidth: true, forceHeight: true, cardWidthMm: 63, cardHeightMm: 88 }),
      ),
    ).toBe(286);
  });

  it('con plantilla, el hueco más grande manda, contando el giro', () => {
    const slot = (id: string, widthMm: number, heightMm: number, rotation: 0 | 90 = 0) => ({
      id,
      xMm: 0,
      yMm: 0,
      widthMm,
      heightMm,
      rotation,
    });
    const template = (slots: ReturnType<typeof slot>[]) =>
      settings({
        mode: 'template',
        template: { id: 't', name: 't', pageMm: { width: 210, height: 297 }, slots },
      });
    // 744 / (80 / 25,4) = 236,2; 1039 / (112 / 25,4) = 235,6.
    expect(printedDpi(image, template([slot('a', 63, 88), slot('b', 80, 112)]))).toBe(236);
    // Un hueco de 88 × 63 girado 90° aloja la carta como 63 × 88.
    expect(printedDpi(image, template([slot('a', 88, 63, 90)]))).toBe(300);
    expect(printedDpi(image, settings({ mode: 'template', template: null }))).toBeNull();
  });
});

describe('lowResolution', () => {
  const forced = settings({
    forceWidth: true,
    forceHeight: true,
    cardWidthMm: 63,
    cardHeightMm: 88,
  });

  it('avisa por debajo de 300 ppp al imprimir', () => {
    expect(MIN_PRINT_DPI).toBe(300);
    expect(lowResolution({ widthPx: 400, heightPx: 560, dpi: { x: 300, y: 300 } }, forced)).toBe(
      true,
    );
    expect(lowResolution(image, forced)).toBe(false);
    expect(lowResolution({ ...image, dpi: { x: 200, y: 200 } }, settings())).toBe(true);
  });

  it('una imagen sin ppp solo avisa si se fuerza el tamaño: si no, ya tiene su propio aviso', () => {
    expect(lowResolution({ ...image, dpi: null }, settings())).toBe(false);
    expect(lowResolution({ widthPx: 400, heightPx: 560, dpi: null }, forced)).toBe(true);
    expect(lowResolution({ ...image, dpi: null }, forced)).toBe(false);
  });
});

describe('cardSizeSummary', () => {
  // 750 × 1050 px a 300 ppp: 750 · 25,4 / 300 = 63,5 mm; 1050 · 25,4 / 300 = 88,9 mm.
  const poker = { widthPx: 750, heightPx: 1050, dpi: { x: 300, y: 300 } };

  it('da el tamaño de la primera carta y cuántas miden distinto', () => {
    // A 150 ppp la misma imagen mide el doble: 127 × 177,8 mm.
    const half = { ...poker, dpi: { x: 150, y: 150 } };
    const summary = cardSizeSummary([poker, half, poker, half], settings());
    expect(summary?.firstMm.width).toBeCloseTo(63.5, 3);
    expect(summary?.firstMm.height).toBeCloseTo(88.9, 3);
    expect(summary?.differentCount).toBe(2);
  });

  it('cuenta las copias, como «N cartas» en la bandeja', () => {
    const half = { ...poker, dpi: { x: 150, y: 150 }, copies: 3 };
    expect(cardSizeSummary([{ ...poker, copies: 2 }, half], settings())?.differentCount).toBe(3);
  });

  it('diferencias de menos del 0,5 % cuentan como el mismo tamaño', () => {
    // 753 px: 63,754 mm, un 0,4 % más. 754 px: 63,839 mm, un 0,53 % más.
    const near = { ...poker, widthPx: 753 };
    const far = { ...poker, widthPx: 754 };
    expect(cardSizeSummary([poker, near], settings())?.differentCount).toBe(0);
    expect(cardSizeSummary([poker, far], settings())?.differentCount).toBe(1);
  });

  it('sin ppp supone 72: 750 px son 264,583 mm', () => {
    const summary = cardSizeSummary([{ ...poker, dpi: null }], settings());
    expect(summary?.firstMm.width).toBeCloseTo(264.583, 3);
    expect(summary?.firstMm.height).toBeCloseTo(370.417, 3);
  });

  it('con recorte mide lo que el recorte a 300 ppp, así que todas salen iguales', () => {
    // 60 mm → 709 px → 60,029 mm; 85 mm → 1004 px → 85,005 mm.
    const crop = { enabled: true, widthMm: 60, heightMm: 85, centered: true, x: 0, y: 0 };
    const big = { widthPx: 1500, heightPx: 2100, dpi: { x: 600, y: 600 } };
    const summary = cardSizeSummary([poker, big], settings({ crop }));
    expect(summary?.firstMm.width).toBeCloseTo(60.029, 3);
    expect(summary?.firstMm.height).toBeCloseTo(85.005, 3);
    expect(summary?.differentCount).toBe(0);
  });

  it('no hay resumen sin cartas, con algún lado forzado ni con plantilla', () => {
    expect(cardSizeSummary([], settings())).toBeNull();
    expect(cardSizeSummary([poker], settings({ forceWidth: true, forceHeight: true }))).toBeNull();
    expect(cardSizeSummary([poker], settings({ forceWidth: true }))).toBeNull();
    expect(cardSizeSummary([poker], settings({ forceHeight: true }))).toBeNull();
    expect(cardSizeSummary([poker], settings({ mode: 'template' }))).toBeNull();
  });
});
