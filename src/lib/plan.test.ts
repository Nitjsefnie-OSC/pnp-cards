import { planDocument, PlanError, type CardSpec } from './plan';
import { DEFAULT_SETTINGS, type LayoutSettings } from './settings';

const dpi300 = { x: 300, y: 300 };
const big: CardSpec = { widthPx: 744, heightPx: 1039, dpi: dpi300, blank: false, copies: 1 };
const small: CardSpec = { widthPx: 372, heightPx: 520, dpi: dpi300, blank: false, copies: 1 };
const blank: CardSpec = { widthPx: 0, heightPx: 0, dpi: null, blank: true, copies: 1 };

function settings(over: Partial<LayoutSettings> = {}): LayoutSettings {
  return { ...DEFAULT_SETTINGS, ...over };
}

describe('planDocument', () => {
  it('reparte las copias de cada carta en páginas, en orden', () => {
    const plan = planDocument(settings(), [
      { ...big, copies: 7 },
      { ...small, copies: 3 },
    ]);
    expect(plan.total).toBe(10);
    expect(plan.pages.map((p) => p.items.map((i) => i.card))).toEqual([
      [0, 0, 0, 0, 0, 0, 0, 1, 1],
      [1],
    ]);
    expect(plan.pages.map((p) => p.number)).toEqual([1, 2]);
  });

  it('ignora las cartas con cero copias', () => {
    const plan = planDocument(settings(), [{ ...big, copies: 0 }, small]);
    expect(plan.pages[0].items.map((i) => i.card)).toEqual([1]);
  });

  it('separa las cartas según la primera carta del documento en todas las páginas', () => {
    const plan = planDocument(settings(), [
      { ...big, copies: 9 },
      { ...small, copies: 2 },
    ]);
    const [first, second] = plan.pages[1].items;
    expect(first.placement.x).toBeCloseTo(22.677, 3);
    // 22,677 + ancho de la carta pequeña (89,28) + separación de la grande (6,983)
    expect(second.placement.x).toBeCloseTo(118.94, 3);
    expect(second.placement.width).toBeCloseTo(89.28, 3);
  });

  it('una imagen en blanco toma el tamaño de la carta anterior', () => {
    const plan = planDocument(settings(), [small, blank]);
    const [, b] = plan.pages[0].items;
    expect(b.placement.width).toBeCloseTo(89.28, 3);
    expect(b.placement.height).toBeCloseTo(124.8, 3);
  });

  it('una imagen en blanco al principio toma el tamaño de la carta siguiente', () => {
    const plan = planDocument(settings(), [blank, big]);
    expect(plan.pages[0].items[0].placement.width).toBeCloseTo(178.56, 3);
  });

  it('con ancho y alto forzados, la imagen en blanco usa ese tamaño', () => {
    const forced = settings({
      forceWidth: true,
      forceHeight: true,
      cardWidthMm: 25.4,
      cardHeightMm: 50.8,
    });
    const item = planDocument(forced, [blank]).pages[0].items[0];
    expect(item.placement.width).toBeCloseTo(72, 6);
    expect(item.placement.height).toBeCloseTo(144, 6);
  });

  it('falla si solo hay imágenes en blanco y no se fuerza el tamaño', () => {
    expect(() => planDocument(settings(), [blank])).toThrow(PlanError);
  });

  it('falla si no hay ninguna carta que imprimir', () => {
    expect(() => planDocument(settings(), [{ ...big, copies: 0 }])).toThrow(PlanError);
  });

  it('calcula el margen de corte de cada página con sus cartas', () => {
    const plan = planDocument(settings({ bleed: { enabled: true, mm: 2, color: '#fff' } }), [
      { ...big, copies: 10 },
    ]);
    expect(plan.pages[0].bleed).toHaveLength(36);
    expect(plan.pages[1].bleed).toHaveLength(4);
  });

  it('traza las líneas de corte con la primera carta de cada página', () => {
    const s = settings({
      placement: 'together',
      cutLines: { enabled: true, style: 'full', color: '#000', widthHundredthsMm: 4 },
    });
    const plan = planDocument(s, [{ ...big, copies: 9 }, small]);
    const xs = (i: number) =>
      plan.pages[i].cutLines!.segments.filter((g) => g.x1 === g.x2).map((g) => g.x1);
    // Página 1: carta grande; página 2: pequeña, con la posición de la grande.
    expect(xs(0)[1] - xs(0)[0]).toBeCloseTo(178.56, 3);
    expect(xs(1)[1] - xs(1)[0]).toBeCloseTo(89.28, 3);
    expect(xs(1)[0]).toBeCloseTo(xs(0)[0], 6);
  });

  it('con las líneas de corte desactivadas, la página no tiene líneas', () => {
    expect(planDocument(settings(), [big]).pages[0].cutLines).toBeNull();
  });
});
