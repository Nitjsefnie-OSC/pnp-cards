import { readDpi } from './dpi';
import { setPngDpi } from './png';

const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function png(...chunks: number[][]) {
  const ihdr = [...be32(13), ...ascii('IHDR'), ...be32(10), ...be32(10), 8, 6, 0, 0, 0, 0, 0, 0, 0];
  const iend = [...be32(0), ...ascii('IEND'), 0xae, 0x42, 0x60, 0x82];
  return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...ihdr, ...chunks.flat(), ...iend]);
}

describe('setPngDpi', () => {
  it('añade el chunk pHYs con los ppp, que luego se leen igual', () => {
    expect(readDpi(setPngDpi(png(), 300))).toEqual({ x: 300, y: 300 });
  });

  it('escribe el pHYs justo después de IHDR con su CRC correcto', () => {
    const out = setPngDpi(png(), 300);
    // 300 ppp = 11811 px/m = 0x2E23; CRC conocido de este chunk: 78 A5 3F 76.
    expect([...out.slice(33, 33 + 21)]).toEqual([
      ...be32(9),
      ...ascii('pHYs'),
      0,
      0,
      0x2e,
      0x23,
      0,
      0,
      0x2e,
      0x23,
      1,
      0x78,
      0xa5,
      0x3f,
      0x76,
    ]);
  });

  it('sustituye un pHYs que ya hubiera', () => {
    const old = [...be32(9), ...ascii('pHYs'), ...be32(2835), ...be32(2835), 1, 0, 0, 0, 0];
    const out = setPngDpi(png(old), 600);
    expect(readDpi(out)).toEqual({ x: 600, y: 600 });
    expect(out.length).toBe(png(old).length);
  });
});
