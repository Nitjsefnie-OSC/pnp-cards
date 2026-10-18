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

  describe('con recorte', () => {
    const cropped = settings({
      crop: { enabled: true, widthMm: 63, heightMm: 88, centered: true, x: 0, y: 0 },
    });
    const noDpi: CardSpec = { widthPx: 822, heightPx: 1122, dpi: null, blank: false, copies: 1 };

    it('la carta mide lo que el recorte, a 300 ppp, aunque la imagen no indique sus ppp', () => {
      const { placement } = planDocument(cropped, [noDpi]).pages[0].items[0];
      expect(placement.width).toBeCloseTo(178.56, 3);
      expect(placement.height).toBeCloseTo(249.36, 3);
    });

    it('centra el recorte en cada imagen por separado', () => {
      const other: CardSpec = { ...noDpi, widthPx: 800, heightPx: 1100 };
      const [a, b] = planDocument(cropped, [noDpi, other]).pages[0].items;
      expect(a.crop).toEqual({ x: 39, y: 42, width: 744, height: 1039 });
      expect(b.crop).toEqual({ x: 28, y: 31, width: 744, height: 1039 });
    });

    it('marca las cartas cuyo recorte no cabe en la imagen', () => {
      const tiny: CardSpec = { ...noDpi, widthPx: 500 };
      const plan = planDocument(cropped, [noDpi, tiny]);
      expect(plan.clampedCards).toEqual([1]);
    });

    it('sin recorte, las colocaciones no tienen recorte', () => {
      expect(planDocument(settings(), [big]).pages[0].items[0].crop).toBeNull();
    });
  });

  describe('con plantilla', () => {
    const template = {
      id: 't',
      name: 'Caja',
      pageMm: { width: 100, height: 150 },
      slots: [
        { id: 'a', xMm: 10, yMm: 10, widthMm: 50, heightMm: 70, rotation: 0 as const },
        { id: 'b', xMm: 10, yMm: 80, widthMm: 70, heightMm: 50, rotation: 90 as const },
      ],
    };
    const tpl = settings({ mode: 'template', template });

    it('usa el tamaño de página de la plantilla y un hueco por carta, en orden', () => {
      const plan = planDocument(tpl, [{ ...big, copies: 3 }]);
      expect(plan.pages).toHaveLength(2);
      expect(plan.pages[0].size.width).toBeCloseTo(283.465, 3);
      expect(plan.pages[0].size.height).toBeCloseTo(425.197, 3);
      expect(plan.pages.map((p) => p.items.length)).toEqual([2, 1]);
    });

    it('cada carta ocupa su hueco, con su giro, aunque la imagen sea de otro tamaño', () => {
      const [first, second] = planDocument(tpl, [{ ...big, copies: 2 }]).pages[0].items;
      expect(first.rotation).toBe(0);
      expect(first.placement.x).toBeCloseTo(28.346, 3);
      // 150 − 10 − 70 = 70 mm desde abajo.
      expect(first.placement.y).toBeCloseTo(198.425, 3);
      expect(first.placement.width).toBeCloseTo(141.732, 3);
      expect(second.rotation).toBe(90);
      expect(second.placement.width).toBeCloseTo(198.425, 3);
    });

    it('las imágenes en blanco no necesitan tamaño: el hueco ya lo tiene', () => {
      expect(() => planDocument(tpl, [blank])).not.toThrow();
    });

    it('pone el margen de corte y marcas de corte alrededor de cada hueco ocupado', () => {
      const s = settings({
        mode: 'template',
        template,
        bleed: { enabled: true, mm: 2, color: '#fff' },
        cutLines: { enabled: true, style: 'normal', color: '#000', widthHundredthsMm: 4 },
      });
      const page = planDocument(s, [big]).pages[0];
      expect(page.bleed).toHaveLength(4);
      expect(page.cutLines!.segments).toHaveLength(8);
      // Las marcas empiezan fuera del margen de corte: 2 mm + 1 pt.
      const left = page.cutLines!.segments.find((g) => g.y1 === g.y2 && g.x2 < g.x1)!;
      expect(left.x1).toBeCloseTo(28.346 - 5.669 - 1, 3);
    });

    it('sin plantilla elegida, o con una sin huecos, no se puede generar', () => {
      expect(() => planDocument(settings({ mode: 'template', template: null }), [big])).toThrow(
        expect.objectContaining({ code: 'no-template' }),
      );
      const empty = { ...template, slots: [] };
      expect(() => planDocument(settings({ mode: 'template', template: empty }), [big])).toThrow(
        expect.objectContaining({ code: 'no-template' }),
      );
    });

    it('a doble cara, en las páginas pares refleja los huecos para que los dorsos coincidan', () => {
      const s = settings({ mode: 'template', template, duplex: true });
      const [front, back] = planDocument(s, [{ ...big, copies: 4 }]).pages;
      // Hueco 1: 10 mm desde la izquierda en el anverso; en el dorso, 10 mm desde la derecha.
      expect(front.items[0].placement.x).toBeCloseTo(28.346, 3);
      expect(back.items[0].placement.x).toBeCloseTo(113.386, 3);
      // Un giro de 90° se convierte en 270° al dar la vuelta a la hoja.
      expect(front.items[1].rotation).toBe(90);
      expect(back.items[1].rotation).toBe(270);
    });

    it('de derecha a izquierda refleja los huecos en todas las páginas', () => {
      const s = settings({ mode: 'template', template, rightToLeft: true });
      const [first] = planDocument(s, [big]).pages;
      expect(first.items[0].placement.x).toBeCloseTo(113.386, 3);
    });
  });
});
