import { readDpi } from './dpi';
import { setJpegDpi } from './jpeg';

const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function jfif(units: number, x: number, y: number) {
  const body = [...ascii('JFIF'), 0, 1, 1, units, ...be16(x), ...be16(y), 0, 0];
  return [0xff, 0xe0, ...be16(body.length + 2), ...body];
}

const jpeg = (...segments: number[][]) =>
  new Uint8Array([0xff, 0xd8, ...segments.flat(), 0xff, 0xda, 0, 2, 0xff, 0xd9]);

describe('setJpegDpi', () => {
  it('pone los ppp en la cabecera JFIF que trae el JPEG de canvas (sin unidades)', () => {
    const out = setJpegDpi(jpeg(jfif(0, 1, 1)), 300);
    expect(readDpi(out)).toEqual({ x: 300, y: 300 });
    expect(out.length).toBe(jpeg(jfif(0, 1, 1)).length);
  });

  it('añade una cabecera JFIF si el JPEG no la tiene', () => {
    const out = setJpegDpi(jpeg(), 150);
    expect(readDpi(out)).toEqual({ x: 150, y: 150 });
    expect([...out.slice(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
  });

  it('no cambia nada más del archivo', () => {
    const src = jpeg(jfif(1, 72, 72));
    const out = setJpegDpi(src, 600);
    expect([...out.slice(20)]).toEqual([...src.slice(20)]);
  });
});
