import { cutLines, type Segment } from './cutLines';
import { DEFAULT_SETTINGS, type CutLineStyle, type LayoutSettings } from './settings';
import { mmToPt } from './units';

const card = { width: mmToPt(63), height: mmToPt(88) };

function settings(style: CutLineStyle, over: Partial<LayoutSettings> = {}): LayoutSettings {
  return {
    ...DEFAULT_SETTINGS,
    placement: 'together',
    cutLines: { enabled: true, style, color: '#000', widthHundredthsMm: 4 },
    ...over,
  };
}

const round = (s: Segment) => [s.x1, s.y1, s.x2, s.y2].map((n) => Number(n.toFixed(3)));

describe('cutLines', () => {
  it('no dibuja nada si las líneas de corte están desactivadas', () => {
    expect(cutLines(DEFAULT_SETTINGS, card, card)).toBeNull();
  });

  it('convierte el grosor de centésimas de mm a puntos', () => {
    expect(cutLines(settings('normal'), card, card)!.lineWidth).toBeCloseTo(0.11339, 5);
  });

  describe('normales: marcas en el margen de la página, a 1 pt de las cartas', () => {
    const { segments } = cutLines(settings('normal'), card, card)!;

    it('dos marcas por borde de columna y por borde de fila', () => {
      expect(segments).toHaveLength(24);
    });

    it('marca el borde izquierdo de la primera columna arriba y abajo', () => {
      expect(segments.map(round)).toContainEqual([29.626, 842, 29.626, 796.173]);
      expect(segments.map(round)).toContainEqual([29.626, 45.827, 29.626, 0]);
    });

    it('marca el borde superior de la primera fila a izquierda y derecha', () => {
      expect(segments.map(round)).toContainEqual([0, 795.173, 28.626, 795.173]);
      expect(segments.map(round)).toContainEqual([566.374, 795.173, 595, 795.173]);
    });
  });

  it('completas: líneas de lado a lado de la página', () => {
    const { segments } = cutLines(settings('full'), card, card)!;
    expect(segments).toHaveLength(12);
    expect(segments.map(round)).toContainEqual([29.626, 842, 29.626, 0]);
    expect(segments.map(round)).toContainEqual([0, 795.173, 595, 795.173]);
  });

  it('completas con cartas separadas: un par de líneas por columna, con la separación', () => {
    const s = settings('full', { placement: 'separated' });
    const xs = cutLines(s, card, card)!
      .segments.filter((g) => g.x1 === g.x2)
      .map((g) => Number(g.x1.toFixed(3)));
    expect(xs).toEqual([22.677, 201.26, 208.209, 386.791, 393.74, 572.323]);
  });

  describe('en cruz', () => {
    const { segments } = cutLines(settings('cross'), card, card)!;

    it('las marcas exteriores entran 5 pt en la zona de cartas', () => {
      expect(segments.map(round)).toContainEqual([29.626, 842, 29.626, 790.173]);
    });

    it('añade cruces de 10 pt entre filas y entre columnas', () => {
      expect(segments).toHaveLength(72);
      expect(segments.map(round)).toContainEqual([29.626, 291.276, 29.626, 301.276]);
    });
  });
});
