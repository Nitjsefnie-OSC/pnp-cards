export type DetectedFormat = 'jpeg' | 'png' | 'tiff' | 'avif' | 'heic' | 'other';

/** Extensiones de imagen admitidas: JFIF y compañía son JPEG con otra extensión. */
const EXTENSIONS = /\.(jpe?g|jfif|jpe|pjpeg|pjp|avif|heic|heif|png|webp|gif|bmp|tiff?)$/i;

/**
 * `accept` de los selectores de imagen. Además de `image/*`, las extensiones que el sistema puede
 * no asociar a un tipo de imagen y que, sin ellas, no saldrían en la lista.
 */
export const IMAGE_ACCEPT = 'image/*,.tif,.tiff,.jfif,.jpe,.pjpeg,.pjp,.avif,.heic,.heif';

/** Marcas de HEIC/HEIF (fotos del iPhone y de algunos Android), imagen o secuencia. */
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1']);

export const isImageFileName = (name: string) => EXTENSIONS.test(name);

/** Formato de una imagen por sus primeros bytes, sin fiarse de la extensión ni del tipo MIME. */
export function detectImageFormat(bytes: Uint8Array): DetectedFormat {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'png';
  const order = String.fromCharCode(bytes[0], bytes[1]);
  if (order === 'II' || order === 'MM') return 'tiff';
  // ISOBMFF: caja ftyp con la marca principal en los bytes 8–11.
  const box = String.fromCharCode(...bytes.subarray(4, 12));
  if (box === 'ftypavif' || box === 'ftypavis') return 'avif';
  if (box.startsWith('ftyp') && HEIC_BRANDS.has(box.slice(4))) return 'heic';
  return 'other';
}
