import { rulerCells, rulerPlacement, type RulerPlacement } from './ruler';
import { mmToPt } from './units';

const A4 = { width: mmToPt(210), height: mmToPt(297) };
/** Rectángulo en puntos PDF a partir de su posición en mm desde arriba a la izquierda. */
const rect = (xMm: number, topMm: number, wMm: number, hMm: number, page = A4) => ({
  x: mmToPt(xMm),
  y: page.height - mmToPt(topMm) - mmToPt(hMm),
  width: mmToPt(wMm),
  height: mmToPt(hMm),
});
/** Altura de las mayúsculas de Helvetica a 6 pt: 0,718 del cuerpo. */
const CAP_6PT = 6 * 0.718;
const header = (where: 'top' | 'bottom' | 'left') => ({
  where,
  size: 7,
  rotation: 0 as const,
  start: { x: 0, y: 0 },
  end: { x: 0, y: 0 },
});

function placed(r: RulerPlacement | null): RulerPlacement {
  if (!r) throw new Error('sin regla');
  return r;
}

describe('rulerPlacement', () => {
  it('con 8,1 mm libres abajo, va abajo, centrada en el hueco y alineada con la primera columna', () => {
    // Tres columnas de póker con 8 mm de margen; la última fila acaba a 288,9 mm.
    const cards = [rect(8, 8, 63.5, 88.9), rect(138.5, 8, 63.5, 88.9), rect(8, 200, 63.5, 88.9)];
    const r = placed(rulerPlacement(A4, cards, [], null));
    expect(r.where).toBe('bottom');
    expect(r.x).toBeCloseTo(mmToPt(8), 6);
    // Centro del hueco a 4,05 mm; la barra mide 2 mm de alto.
    expect(r.y).toBeCloseTo(mmToPt(3.05), 6);
    expect(r.width).toBeCloseTo(mmToPt(50), 6);
    expect(r.height).toBeCloseTo(mmToPt(2), 6);
    // El rótulo va 2 mm a la derecha de la barra, con las mayúsculas centradas en ella.
    expect(r.label.size).toBe(6);
    expect(r.label.x).toBeCloseTo(mmToPt(60), 6);
    expect(r.label.y).toBeCloseTo(mmToPt(3.05) + (mmToPt(2) - CAP_6PT) / 2, 6);
  });

  it('si la cabecera está abajo, va arriba', () => {
    const cards = [rect(10, 6, 63.5, 88.9)];
    const r = placed(rulerPlacement(A4, cards, [], header('bottom')));
    expect(r.where).toBe('top');
    // 6 mm libres arriba: centro a 3 mm del borde, barra desde 4 mm.
    expect(r.y).toBeCloseTo(A4.height - mmToPt(4), 6);
    expect(r.x).toBeCloseTo(mmToPt(10), 6);
  });

  it('con la cabecera arriba o en el lateral, se queda abajo', () => {
    const cards = [rect(10, 6, 63.5, 88.9)];
    expect(placed(rulerPlacement(A4, cards, [], header('top'))).where).toBe('bottom');
    expect(placed(rulerPlacement(A4, cards, [], header('left'))).where).toBe('bottom');
  });

  it('con menos de 4 mm abajo pero sí arriba, va arriba', () => {
    const cards = [rect(10, 5, 63.5, 289)];
    const r = placed(rulerPlacement(A4, cards, [], null));
    expect(r.where).toBe('top');
    expect(r.y).toBeCloseTo(A4.height - mmToPt(3.5), 6);
  });

  it('con menos de 4 mm arriba y abajo, no hay regla', () => {
    expect(rulerPlacement(A4, [rect(1, 1, 208, 295)], [], null)).toBeNull();
  });

  it('el margen de corte ocupa sitio, pero la barra se alinea con las cartas', () => {
    const cards = [rect(8, 8, 194, 281)];
    const bleed = [rect(4, 4, 202, 289)];
    const r = placed(rulerPlacement(A4, cards, bleed, null));
    expect(r.where).toBe('bottom');
    expect(r.x).toBeCloseTo(mmToPt(8), 6);
    // 4 mm justos: centro a 2 mm, barra desde 1 mm.
    expect(r.y).toBeCloseTo(mmToPt(1), 6);
  });

  it('sin cartas o en una página donde no cabe a lo ancho, no hay regla', () => {
    expect(rulerPlacement(A4, [], [], null)).toBeNull();
    const narrow = { width: mmToPt(60), height: mmToPt(100) };
    expect(rulerPlacement(narrow, [rect(5, 5, 50, 80, narrow)], [], null)).toBeNull();
  });
});

describe('rulerCells', () => {
  it('son las cinco casillas rellenas de 5 mm, alternas, desde el principio de la barra', () => {
    const r: RulerPlacement = {
      where: 'bottom',
      x: 10,
      y: 20,
      width: mmToPt(50),
      height: mmToPt(2),
      label: { x: 0, y: 0, size: 6 },
    };
    const cells = rulerCells(r);
    expect(cells).toHaveLength(5);
    cells.forEach((c, i) => {
      expect(c.x).toBeCloseTo(10 + mmToPt(10 * i), 6);
      expect(c.y).toBe(20);
      expect(c.width).toBeCloseTo(mmToPt(5), 6);
      expect(c.height).toBeCloseTo(mmToPt(2), 6);
    });
  });
});
