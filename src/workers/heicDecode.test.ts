// @vitest-environment node
import { readFileSync } from 'node:fs';
import { decodeHeic } from './heicDecode';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url)));

describe('decodeHeic', () => {
  // rotated.heic: 24 × 16 px, mitad izquierda roja y derecha azul, con giro de 90° a la derecha
  // (caja irot, como una foto del móvil en vertical). Derecha: 16 × 24, rojo arriba.
  it('aplica el giro de la foto', async () => {
    const { width, height, data } = await decodeHeic(fixture('rotated.heic'));
    expect([width, height]).toEqual([16, 24]);
    const pixel = (x: number, y: number) => [
      ...data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4),
    ];
    const [r1, , b1, a1] = pixel(8, 2);
    expect(r1).toBeGreaterThan(200);
    expect(b1).toBeLessThan(50);
    expect(a1).toBe(255);
    const [r2, , b2] = pixel(8, 21);
    expect(r2).toBeLessThan(50);
    expect(b2).toBeGreaterThan(200);
  });

  it('falla con un archivo que no es HEIC', async () => {
    await expect(decodeHeic(fixture('card.png'))).rejects.toThrow();
  });
});
