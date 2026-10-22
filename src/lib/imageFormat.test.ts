import { detectImageFormat, IMAGE_ACCEPT, isImageFileName } from './imageFormat';

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Caja ftyp ISOBMFF: tamaño (4 bytes), 'ftyp', marca principal, versión y marcas compatibles. */
function ftyp(major: string, ...compatible: string[]): Uint8Array {
  const size = 16 + compatible.length * 4;
  return new Uint8Array([
    0,
    0,
    0,
    size,
    ...ascii('ftyp'),
    ...ascii(major),
    0,
    0,
    0,
    0,
    ...compatible.flatMap(ascii),
  ]);
}

describe('detectImageFormat', () => {
  it('reconoce JPEG (también JFIF) por FF D8', () => {
    expect(
      detectImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...ascii('JFIF')])),
    ).toBe('jpeg');
  });

  it('reconoce PNG', () => {
    expect(
      detectImageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('png');
  });

  it('reconoce TIFF en los dos órdenes de bytes', () => {
    expect(detectImageFormat(new Uint8Array([...ascii('II'), 42, 0]))).toBe('tiff');
    expect(detectImageFormat(new Uint8Array([...ascii('MM'), 0, 42]))).toBe('tiff');
  });

  it('reconoce AVIF por la marca de la caja ftyp (imagen y secuencia)', () => {
    expect(detectImageFormat(ftyp('avif', 'mif1', 'miaf'))).toBe('avif');
    expect(detectImageFormat(ftyp('avis', 'avif', 'msf1'))).toBe('avif');
  });

  it('no confunde otros ftyp (vídeo MP4, HEIC) con AVIF', () => {
    expect(detectImageFormat(ftyp('isom', 'mp41'))).toBe('other');
    expect(detectImageFormat(ftyp('heic', 'mif1'))).toBe('other');
  });

  it('devuelve other con WebP, GIF o archivos cortos', () => {
    expect(detectImageFormat(new Uint8Array(ascii('RIFF\0\0\0\0WEBP')))).toBe('other');
    expect(detectImageFormat(new Uint8Array(ascii('GIF89a')))).toBe('other');
    expect(detectImageFormat(new Uint8Array([]))).toBe('other');
  });
});

describe('isImageFileName', () => {
  it.each([
    'carta.jpg',
    'carta.JPEG',
    'carta.jfif',
    'carta.JFIF',
    'carta.jpe',
    'carta.pjpeg',
    'carta.pjp',
    'carta.avif',
    'carta.png',
    'carta.webp',
    'carta.gif',
    'carta.bmp',
    'carta.tif',
    'carta.tiff',
  ])('acepta %s', (name) => {
    expect(isImageFileName(name)).toBe(true);
  });

  it.each(['carta.pdf', 'carta.txt', 'jfif', 'carta.jfif.zip', 'carta.heic'])(
    'rechaza %s',
    (name) => {
      expect(isImageFileName(name)).toBe(false);
    },
  );
});

describe('IMAGE_ACCEPT', () => {
  it('incluye image/* y las extensiones que el sistema puede no asociar a imagen', () => {
    const parts = IMAGE_ACCEPT.split(',');
    expect(parts).toEqual(
      expect.arrayContaining([
        'image/*',
        '.tif',
        '.tiff',
        '.jfif',
        '.jpe',
        '.pjpeg',
        '.pjp',
        '.avif',
      ]),
    );
  });
});
