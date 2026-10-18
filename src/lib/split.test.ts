import { detectBorder, splitGrid } from './split';

describe('splitGrid', () => {
  it('divide la zona en filas × columnas, de izquierda a derecha y de arriba abajo', () => {
    const parts = splitGrid({ x: 10, y: 20, width: 600, height: 400 }, 3, 2);
    expect(parts).toEqual([
      { x: 10, y: 20, width: 200, height: 200 },
      { x: 210, y: 20, width: 200, height: 200 },
      { x: 410, y: 20, width: 200, height: 200 },
      { x: 10, y: 220, width: 200, height: 200 },
      { x: 210, y: 220, width: 200, height: 200 },
      { x: 410, y: 220, width: 200, height: 200 },
    ]);
  });

  it('si no sale exacto, reparte el sobrante: unas partes miden 1 px más', () => {
    const parts = splitGrid({ x: 0, y: 0, width: 1000, height: 100 }, 3, 1);
    expect(parts.map((p) => [p.x, p.width])).toEqual([
      [0, 333],
      [333, 333],
      [666, 334],
    ]);
  });

  it('las partes cubren la zona entera sin huecos', () => {
    const region = { x: 7, y: 3, width: 1001, height: 997 };
    const parts = splitGrid(region, 7, 6);
    const area = parts.reduce((a, p) => a + p.width * p.height, 0);
    expect(area).toBe(region.width * region.height);
  });
});

/** Imagen RGBA de prueba: fondo de un color y un rectángulo de otro. */
function image(
  width: number,
  height: number,
  background: [number, number, number],
  box: { x: number; y: number; width: number; height: number },
  fill: [number, number, number] = [200, 30, 30],
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height;
      const [r, g, b] = inside ? fill : background;
      data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

describe('detectBorder', () => {
  it('encuentra la zona de las cartas dentro de un margen blanco', () => {
    const img = image(100, 80, [255, 255, 255], { x: 12, y: 9, width: 70, height: 60 });
    expect(detectBorder(img)).toEqual({ x: 12, y: 9, width: 70, height: 60 });
  });

  it('funciona con un margen de otro color', () => {
    const img = image(50, 50, [20, 90, 70], { x: 5, y: 6, width: 30, height: 40 }, [250, 250, 250]);
    expect(detectBorder(img)).toEqual({ x: 5, y: 6, width: 30, height: 40 });
  });

  it('tolera las pequeñas variaciones del margen por la compresión', () => {
    const img = image(40, 40, [255, 255, 255], { x: 10, y: 10, width: 20, height: 20 });
    // Ruido de compresión en el margen: casi blanco.
    for (let i = 0; i < 40 * 4; i += 4) img.data.set([246, 250, 244], i);
    expect(detectBorder(img)).toEqual({ x: 10, y: 10, width: 20, height: 20 });
  });

  it('sin margen, devuelve la imagen entera', () => {
    const img = image(30, 20, [255, 255, 255], { x: 0, y: 0, width: 30, height: 20 });
    expect(detectBorder(img)).toEqual({ x: 0, y: 0, width: 30, height: 20 });
  });

  it('una imagen de un solo color también devuelve la imagen entera', () => {
    const img = image(30, 20, [255, 255, 255], { x: 0, y: 0, width: 0, height: 0 });
    expect(detectBorder(img)).toEqual({ x: 0, y: 0, width: 30, height: 20 });
  });
});
