import { headerPlacement, type HeaderPlacement } from './header';
import { mmToPt } from './units';

const A4 = { width: mmToPt(210), height: mmToPt(297) };
/** Rectángulo en puntos PDF a partir de su posición en mm desde arriba a la izquierda. */
const rect = (xMm: number, topMm: number, wMm: number, hMm: number, page = A4) => ({
  x: mmToPt(xMm),
  y: page.height - mmToPt(topMm) - mmToPt(hMm),
  width: mmToPt(wMm),
  height: mmToPt(hMm),
});
/** Mitad de la altura de las mayúsculas de Helvetica: 0,718 del cuerpo. */
const halfCap = (size: number) => (size * 0.718) / 2;

function placed(h: HeaderPlacement | null): HeaderPlacement {
  if (!h) throw new Error('sin cabecera');
  return h;
}

describe('headerPlacement', () => {
  it('con 8 mm libres arriba, va arriba a 7 pt, centrada en el hueco y alineada con las cartas', () => {
    // Tres columnas de póker con 8 mm de margen: el bloque va de x = 8 a x = 202 mm.
    const cards = [rect(8, 8, 63.5, 88.9), rect(138.5, 8, 63.5, 88.9), rect(8, 200, 63.5, 88.9)];
    const h = placed(headerPlacement(A4, cards, []));
    expect(h.where).toBe('top');
    expect(h.size).toBe(7);
    expect(h.rotation).toBe(0);
    expect(h.start.x).toBeCloseTo(mmToPt(9.5), 6);
    expect(h.end.x).toBeCloseTo(mmToPt(200.5), 6);
    expect(h.start.y).toBeCloseTo(A4.height - mmToPt(4) - halfCap(7), 6);
    expect(h.end.y).toBe(h.start.y);
  });

  it('sin hueco arriba pero sí abajo, va abajo', () => {
    const cards = [rect(10, 0, 63.5, 88.9)];
    const h = placed(headerPlacement(A4, cards, []));
    expect(h.where).toBe('bottom');
    expect(h.size).toBe(7);
    // 208,1 mm libres abajo: la línea base queda en el centro menos media mayúscula.
    expect(h.start.y).toBeCloseTo(mmToPt(208.1) / 2 - halfCap(7), 6);
    expect(h.start.x).toBeCloseTo(mmToPt(11.5), 6);
    expect(h.end.x).toBeCloseTo(mmToPt(72), 6);
  });

  it('sin hueco arriba ni abajo, va en el lateral izquierdo girada 90°, de abajo arriba', () => {
    const cards = [rect(10, 0, 190, 297)];
    const h = placed(headerPlacement(A4, cards, []));
    expect(h.where).toBe('left');
    expect(h.rotation).toBe(90);
    expect(h.size).toBe(7);
    // Centro del hueco de 10 mm; girado, la mayúscula se extiende hacia la izquierda de la base.
    expect(h.start.x).toBeCloseTo(mmToPt(5) + halfCap(7), 6);
    expect(h.end.x).toBe(h.start.x);
    expect(h.start.y).toBeCloseTo(mmToPt(1.5), 6);
    expect(h.end.y).toBeCloseTo(A4.height - mmToPt(1.5), 6);
  });

  it('con menos de 5 mm pero al menos 3, usa letra pequeña de 5 pt', () => {
    const cards = [rect(3, 3, 204, 291)];
    const h = placed(headerPlacement(A4, cards, []));
    expect(h.where).toBe('top');
    expect(h.size).toBe(5);
    expect(h.start.y).toBeCloseTo(A4.height - mmToPt(1.5) - halfCap(5), 6);
  });

  it('con menos de 3 mm en todas partes, no hay cabecera', () => {
    expect(headerPlacement(A4, [rect(1, 1, 208, 295)], [])).toBeNull();
  });

  it('el margen de corte ocupa sitio, pero el texto se alinea con las cartas', () => {
    const cards = [rect(8, 8, 194, 281)];
    const bleed = [rect(4, 4, 202, 289)];
    const h = placed(headerPlacement(A4, cards, bleed));
    expect(h.where).toBe('top');
    expect(h.size).toBe(5);
    expect(h.start.y).toBeCloseTo(A4.height - mmToPt(2) - halfCap(5), 6);
    expect(h.start.x).toBeCloseTo(mmToPt(9.5), 6);
  });

  it('un hueco de 5 mm justos vale aunque el redondeo lo deje una micra por debajo', () => {
    const cards = [rect(5, 5, 200, 287)];
    const h = placed(headerPlacement(A4, cards, []));
    expect(h.where).toBe('top');
    expect(h.size).toBe(7);
  });

  it('prefiere arriba aunque abajo haya más sitio', () => {
    const cards = [rect(10, 6, 63.5, 88.9)];
    expect(placed(headerPlacement(A4, cards, [])).where).toBe('top');
  });
});
