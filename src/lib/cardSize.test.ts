import { cardSize } from './cardSize';
import { DEFAULT_SETTINGS, type LayoutSettings } from './settings';

const image = { widthPx: 744, heightPx: 1039 };

function settings(over: Partial<LayoutSettings>): LayoutSettings {
  return { ...DEFAULT_SETTINGS, ...over };
}

describe('cardSize', () => {
  it('a 300 ppp escala al 24 % como el original (72/300)', () => {
    const size = cardSize({ ...image, dpi: { x: 300, y: 300 } }, DEFAULT_SETTINGS);
    expect(size.width).toBeCloseTo(178.56, 4);
    expect(size.height).toBeCloseTo(249.36, 4);
  });

  it('usa los ppp reales de la imagen', () => {
    const size = cardSize({ ...image, dpi: { x: 150, y: 150 } }, DEFAULT_SETTINGS);
    expect(size.width).toBeCloseTo(357.12, 4);
    expect(size.height).toBeCloseTo(498.72, 4);
  });

  it('sin ppp en los metadatos usa 1 px = 1 pt (72 ppp), como el original', () => {
    expect(cardSize({ ...image, dpi: null }, DEFAULT_SETTINGS)).toEqual({
      width: 744,
      height: 1039,
    });
  });

  it('fuerza ancho y alto en mm', () => {
    const size = cardSize(
      { ...image, dpi: null },
      settings({ forceWidth: true, forceHeight: true, cardWidthMm: 63, cardHeightMm: 88 }),
    );
    expect(size.width).toBeCloseTo(178.5827, 3);
    expect(size.height).toBeCloseTo(249.4488, 3);
  });

  it('forzando solo el ancho conserva la proporción', () => {
    const size = cardSize({ ...image, dpi: null }, settings({ forceWidth: true, cardWidthMm: 63 }));
    expect(size.width).toBeCloseTo(178.5827, 3);
    expect(size.height).toBeCloseTo(249.3917, 3);
  });

  it('forzando solo el alto conserva la proporción', () => {
    const size = cardSize(
      { ...image, dpi: { x: 300, y: 300 } },
      settings({ forceHeight: true, cardHeightMm: 88 }),
    );
    expect(size.width).toBeCloseTo(178.6236, 3);
    expect(size.height).toBeCloseTo(249.4488, 3);
  });
});
