import { layoutPage } from './layout';
import { DEFAULT_SETTINGS, type LayoutSettings } from './settings';
import { mmToPt } from './units';

// Carta estándar de 63 × 88 mm.
const card = { width: mmToPt(63), height: mmToPt(88) };
const nine = Array.from({ length: 9 }, () => card);

function settings(over: Partial<LayoutSettings> = {}): LayoutSettings {
  return { ...DEFAULT_SETTINGS, ...over };
}

function xy(p: { x: number; y: number }) {
  return [Number(p.x.toFixed(3)), Number(p.y.toFixed(3))];
}

describe('layoutPage', () => {
  describe('vertical 3x3 en A4, separadas con margen de 8 mm', () => {
    const { page, placements } = layoutPage(settings(), nine);

    it('usa una página A4 vertical de 595 × 842 pt', () => {
      expect(page).toEqual({ width: 595, height: 842 });
    });

    it('coloca la primera carta en la esquina superior izquierda, dentro del margen', () => {
      expect(xy(placements[0])).toEqual([22.677, 569.874]);
    });

    it('reparte la separación sobrante entre las cartas', () => {
      expect(xy(placements[4])).toEqual([208.209, 296.276]);
      expect(xy(placements[8])).toEqual([393.74, 22.677]);
    });

    it('da a cada colocación el tamaño de su carta', () => {
      expect(placements[0].width).toBeCloseTo(card.width, 6);
      expect(placements[0].height).toBeCloseTo(card.height, 6);
    });
  });

  it('pegadas: centra el bloque de cartas en la página', () => {
    const { placements } = layoutPage(settings({ placement: 'together' }), nine);
    expect(xy(placements[0])).toEqual([29.626, 545.724]);
    expect(placements[1].x - placements[0].x).toBeCloseTo(card.width, 6);
  });

  it('de derecha a izquierda: la primera carta va en la última columna', () => {
    const { placements } = layoutPage(settings({ placement: 'together', rightToLeft: true }), nine);
    expect(xy(placements[0])).toEqual([386.791, 545.724]);
  });

  it('horizontal 4x2: A4 apaisado con 4 columnas y 2 filas', () => {
    const eight = nine.slice(0, 8);
    const { page, placements } = layoutPage(settings({ mode: 'horizontal8' }), eight);
    expect(page).toEqual({ width: 842, height: 595 });
    expect(xy(placements[7])).toEqual([640.74, 22.677]);
  });

  it('manual: A3 apaisado', () => {
    const { page } = layoutPage(settings({ mode: 'manual', paper: 'A3', landscape: true }), [card]);
    expect(page).toEqual({ width: 1191, height: 842 });
  });

  it('manual: página personalizada en mm', () => {
    const { page } = layoutPage(
      settings({ mode: 'manual', paper: 'custom', customPageMm: { width: 100, height: 150 } }),
      [card],
    );
    expect(page.width).toBeCloseTo(283.465, 3);
    expect(page.height).toBeCloseTo(425.197, 3);
  });

  it('manual 1x1: centra la carta dentro de los márgenes', () => {
    const { placements } = layoutPage(settings({ mode: 'manual', columns: 1, rows: 1 }), [card]);
    expect(xy(placements[0])).toEqual([208.209, 296.276]);
  });

  it('una página incompleta solo tiene las cartas que recibe', () => {
    expect(layoutPage(settings(), nine.slice(0, 4)).placements).toHaveLength(4);
  });

  it('la separación se calcula con la carta de referencia del documento', () => {
    const small = { width: card.width / 2, height: card.height / 2 };
    const { placements } = layoutPage(settings(), [small, small], card);
    // Misma separación que con cartas de 63 × 88 (6,949 pt), con el ancho de la carta pequeña.
    expect(placements[1].x - placements[0].x).toBeCloseTo(small.width + 6.949, 3);
  });
});
