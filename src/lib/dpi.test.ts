import { readDpi } from './dpi';

const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function jpeg(...segments: number[][]): Uint8Array {
  return new Uint8Array([0xff, 0xd8, ...segments.flat(), 0xff, 0xda, 0, 2, 0xff, 0xd9]);
}

function jfif(units: number, x: number, y: number): number[] {
  const body = [...ascii('JFIF'), 0, 1, 2, units, ...be16(x), ...be16(y), 0, 0];
  return [0xff, 0xe0, ...be16(body.length + 2), ...body];
}

/** APP1 Exif big-endian con XResolution, YResolution (racionales) y ResolutionUnit. */
function exif(x: number, y: number, unit: number): number[] {
  const entries = 3;
  const ifdStart = 8;
  const dataStart = ifdStart + 2 + entries * 12 + 4;
  const tiff = [
    ...ascii('MM'),
    ...be16(42),
    ...be32(ifdStart),
    ...be16(entries),
    ...be16(0x011a),
    ...be16(5),
    ...be32(1),
    ...be32(dataStart),
    ...be16(0x011b),
    ...be16(5),
    ...be32(1),
    ...be32(dataStart + 8),
    ...be16(0x0128),
    ...be16(3),
    ...be32(1),
    ...be16(unit),
    0,
    0,
    ...be32(0),
    ...be32(x),
    ...be32(1),
    ...be32(y),
    ...be32(1),
  ];
  const body = [...ascii('Exif'), 0, 0, ...tiff];
  return [0xff, 0xe1, ...be16(body.length + 2), ...body];
}

function png(chunks: number[][]): Uint8Array {
  const ihdr = [...be32(13), ...ascii('IHDR'), ...be32(10), ...be32(10), 8, 6, 0, 0, 0, 0, 0, 0, 0];
  const iend = [...be32(0), ...ascii('IEND'), 0, 0, 0, 0];
  return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...ihdr, ...chunks.flat(), ...iend]);
}

function phys(ppuX: number, ppuY: number, unit: number): number[] {
  return [...be32(9), ...ascii('pHYs'), ...be32(ppuX), ...be32(ppuY), unit, 0, 0, 0, 0];
}

describe('readDpi', () => {
  it('lee los ppp de la cabecera JFIF en puntos por pulgada', () => {
    expect(readDpi(jpeg(jfif(1, 300, 300)))).toEqual({ x: 300, y: 300 });
  });

  it('convierte JFIF en puntos por centímetro a ppp', () => {
    // 118 ppcm × 2,54 = 299,72 → 300
    expect(readDpi(jpeg(jfif(2, 118, 118)))).toEqual({ x: 300, y: 300 });
  });

  it('usa EXIF cuando JFIF no indica unidades', () => {
    expect(readDpi(jpeg(jfif(0, 1, 1), exif(150, 150, 2)))).toEqual({ x: 150, y: 150 });
  });

  it('lee el chunk pHYs de un PNG en píxeles por metro', () => {
    // 11811 px/m × 0,0254 = 299,9994 → 300
    expect(readDpi(png([phys(11811, 11811, 1)]))).toEqual({ x: 300, y: 300 });
  });

  it('devuelve null si no hay información de resolución', () => {
    expect(readDpi(png([]))).toBeNull();
    expect(readDpi(png([phys(1, 1, 0)]))).toBeNull();
    expect(readDpi(jpeg(jfif(0, 1, 1)))).toBeNull();
    expect(readDpi(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('lee la resolución de un TIFF', () => {
    const app1 = exif(200, 200, 2);
    const tiff = new Uint8Array(app1.slice(4 + 6));
    expect(readDpi(tiff)).toEqual({ x: 200, y: 200 });
  });
});
