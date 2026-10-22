export type DetectedFormat = 'jpeg' | 'png' | 'tiff' | 'avif' | 'other';

/** Extensiones de imagen admitidas: JFIF y compañía son JPEG con otra extensión. */
const EXTENSIONS = /\.(jpe?g|jfif|jpe|pjpeg|pjp|avif|png|webp|gif|bmp|tiff?)$/i;

/**
 * `accept` de los selectores de imagen. Además de `image/*`, las extensiones que el sistema puede
 * no asociar a un tipo de imagen y que, sin ellas, no saldrían en la lista.
 */
export const IMAGE_ACCEPT = 'image/*,.tif,.tiff,.jfif,.jpe,.pjpeg,.pjp,.avif';

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
  return 'other';
}
