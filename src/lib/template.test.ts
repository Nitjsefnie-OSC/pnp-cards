import { DEFAULT_SETTINGS } from './settings';
import {
  combineRotations,
  parseTemplateFile,
  serializeTemplate,
  slotBox,
  slotCropMarks,
  slotLocalSize,
  slotMatrix,
  slotSvgMatrix,
  templateFromLayout,
  type Template,
} from './template';

const A4 = { width: 210, height: 297 };
const slot = { id: 's', xMm: 10, yMm: 20, widthMm: 63, heightMm: 88, rotation: 0 as const };

/** Aplica la matriz [a b c d e f] de PDF a un punto. */
const apply = ([a, b, c, d, e, f]: number[], x: number, y: number) => [
  Number((a * x + c * y + e).toFixed(3)),
  Number((b * x + d * y + f).toFixed(3)),
];

describe('slotBox', () => {
  it('pasa el hueco de mm desde arriba a la izquierda a puntos PDF desde abajo', () => {
    const box = slotBox(slot, 842);
    expect(box.x).toBeCloseTo(28.346, 3);
    expect(box.y).toBeCloseTo(535.858, 3);
    expect(box.width).toBeCloseTo(178.583, 3);
    expect(box.height).toBeCloseTo(249.449, 3);
  });
});

describe('slotMatrix', () => {
  const box = { x: 100, y: 200, width: 60, height: 90 };

  it('sin rotar, la carta ocupa el hueco tal cual', () => {
    expect(slotLocalSize(box, 0)).toEqual({ width: 60, height: 90 });
    const m = slotMatrix(box, 0);
    expect(apply(m, 0, 0)).toEqual([100, 200]);
    expect(apply(m, 60, 90)).toEqual([160, 290]);
  });

  it('a 90° la carta gira a la izquierda y ocupa el mismo hueco', () => {
    // La carta (90 × 60 una vez girada) llena el hueco de 60 × 90.
    expect(slotLocalSize(box, 90)).toEqual({ width: 90, height: 60 });
    const m = slotMatrix(box, 90);
    // Su esquina inferior izquierda va a la inferior derecha del hueco.
    expect(apply(m, 0, 0)).toEqual([160, 200]);
    expect(apply(m, 90, 60)).toEqual([100, 290]);
  });

  it('a 180° queda boca abajo', () => {
    const m = slotMatrix(box, 180);
    expect(apply(m, 0, 0)).toEqual([160, 290]);
    expect(apply(m, 60, 90)).toEqual([100, 200]);
  });

  it('a 270° gira a la derecha', () => {
    const m = slotMatrix(box, 270);
    expect(apply(m, 0, 0)).toEqual([100, 290]);
    expect(apply(m, 90, 60)).toEqual([160, 200]);
  });
});

describe('slotSvgMatrix', () => {
  // En SVG la Y crece hacia abajo; la carta se dibuja de 0,0 (arriba a la izquierda) a su tamaño.
  const box = { x: 100, y: 200, width: 60, height: 90 };
  const H = 842;

  it('sin rotar, la esquina superior izquierda de la carta va a la del hueco', () => {
    const m = slotSvgMatrix(box, 0, H);
    expect(apply(m, 0, 0)).toEqual([100, 552]);
    expect(apply(m, 60, 90)).toEqual([160, 642]);
  });

  it('a 90° (a la izquierda), el borde de arriba de la carta queda a la izquierda del hueco', () => {
    const m = slotSvgMatrix(box, 90, H);
    // Esquina superior izquierda de la carta → inferior izquierda del hueco en pantalla.
    expect(apply(m, 0, 0)).toEqual([100, 642]);
    expect(apply(m, 90, 60)).toEqual([160, 552]);
  });
});

describe('slotCropMarks', () => {
  it('pone dos marcas en cada esquina, por fuera del hueco y separadas de él', () => {
    const marks = slotCropMarks({ x: 100, y: 200, width: 60, height: 90 }, 2, 10);
    expect(marks).toHaveLength(8);
    // Esquina inferior izquierda: una marca horizontal a la izquierda y otra vertical debajo.
    expect(marks).toContainEqual({ x1: 98, y1: 200, x2: 88, y2: 200 });
    expect(marks).toContainEqual({ x1: 100, y1: 198, x2: 100, y2: 188 });
    // Esquina superior derecha.
    expect(marks).toContainEqual({ x1: 162, y1: 290, x2: 172, y2: 290 });
    expect(marks).toContainEqual({ x1: 160, y1: 292, x2: 160, y2: 302 });
  });
});

describe('templateFromLayout', () => {
  it('convierte la distribución actual en huecos en mm, en orden de relleno', () => {
    const t = templateFromLayout(DEFAULT_SETTINGS, { widthMm: 63, heightMm: 88 }, 'Mi plantilla');
    expect(t.name).toBe('Mi plantilla');
    expect(t.pageMm).toEqual(A4);
    expect(t.slots).toHaveLength(9);
    // Primera carta: en el margen de 8 mm, arriba a la izquierda.
    expect(t.slots[0]).toMatchObject({ xMm: 8, yMm: 8, widthMm: 63, heightMm: 88, rotation: 0 });
    expect(t.slots[1].xMm).toBeCloseTo(8 + 63 + 2.45, 2);
  });
});

describe('archivo .pnptemplate', () => {
  const template: Template = { id: 'abc', name: 'Caja', pageMm: A4, slots: [slot] };

  it('al guardarla y abrirla se recupera la misma plantilla (con un id nuevo)', () => {
    const read = parseTemplateFile(serializeTemplate(template));
    expect({ ...read, id: 'abc', slots: read.slots.map((s) => ({ ...s, id: 's' })) }).toEqual(
      template,
    );
    expect(read.id).not.toBe('abc');
  });

  it('rechaza archivos que no son plantillas', () => {
    expect(() => parseTemplateFile('{"format":"otra"}')).toThrow();
    expect(() => parseTemplateFile('hola')).toThrow();
  });

  it('corrige valores no válidos: rotación y tamaños', () => {
    const read = parseTemplateFile(
      JSON.stringify({
        format: 'pnp-cards-template',
        version: 1,
        name: 'x',
        pageMm: { width: 210, height: 297 },
        slots: [{ xMm: 0, yMm: 0, widthMm: -5, heightMm: 50, rotation: 45 }],
      }),
    );
    expect(read.slots[0]).toMatchObject({ widthMm: 1, rotation: 0 });
  });
});

describe('combineRotations', () => {
  it('suma dos giros antihorarios, dando la vuelta a los 360°', () => {
    expect(combineRotations(0, 90)).toBe(90);
    expect(combineRotations(180, 270)).toBe(90);
    expect(combineRotations(90, 270)).toBe(0);
  });
});
