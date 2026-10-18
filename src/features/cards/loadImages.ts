import { readDpi } from '../../lib/dpi';
import type { ImageFormat, NewImage } from '../../store/cardsStore';

const ACCEPTED = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
const THUMB_HEIGHT = 300;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const isAcceptedImage = (file: File) =>
  file.type.startsWith('image/') || ACCEPTED.test(file.name);

/** Ordena por nombre, como hacía PDFCartas al soltar archivos. */
export const sortByName = (files: File[]) =>
  [...files].sort((a, b) => collator.compare(a.name, b.name));

function detectFormat(bytes: Uint8Array): ImageFormat | 'tiff' | 'other' {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'png';
  const order = String.fromCharCode(bytes[0], bytes[1]);
  if (order === 'II' || order === 'MM') return 'tiff';
  return 'other';
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), type, quality),
  );
}

function drawToCanvas(source: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(source, 0, 0, width, height);
  return canvas;
}

async function tiffToPng(buffer: ArrayBuffer): Promise<Blob> {
  const UTIF = (await import('utif2')).default;
  const [ifd] = UTIF.decode(buffer);
  UTIF.decodeImage(buffer, ifd);
  const rgba = new Uint8ClampedArray(UTIF.toRGBA8(ifd));
  const canvas = document.createElement('canvas');
  canvas.width = ifd.width;
  canvas.height = ifd.height;
  canvas.getContext('2d')!.putImageData(new ImageData(rgba, ifd.width, ifd.height), 0, 0);
  return canvasToBlob(canvas, 'image/png');
}

async function thumbnail(bitmap: ImageBitmap): Promise<string> {
  const height = Math.min(THUMB_HEIGHT, bitmap.height);
  const width = Math.max(1, Math.round((bitmap.width * height) / bitmap.height));
  const blob = await canvasToBlob(drawToCanvas(bitmap, width, height), 'image/jpeg', 0.85);
  return URL.createObjectURL(blob);
}

/**
 * Lee un archivo de imagen: ppp, tamaño en píxeles y miniatura. JPG y PNG se guardan tal cual
 * (se incrustarán sin recodificar); TIFF, WebP y demás se convierten a PNG.
 */
export async function loadImage(file: File): Promise<NewImage> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const detected = detectFormat(bytes);
  const dpi = readDpi(bytes);

  let blob: Blob;
  let format: ImageFormat;
  if (detected === 'jpeg' || detected === 'png') {
    blob = new Blob([buffer], { type: `image/${detected}` });
    format = detected;
  } else if (detected === 'tiff') {
    blob = await tiffToPng(buffer);
    format = 'png';
  } else {
    const bitmap = await createImageBitmap(file);
    blob = await canvasToBlob(drawToCanvas(bitmap, bitmap.width, bitmap.height), 'image/png');
    bitmap.close();
    format = 'png';
  }

  const bitmap = await createImageBitmap(blob);
  try {
    return {
      name: file.name,
      blob,
      format,
      widthPx: bitmap.width,
      heightPx: bitmap.height,
      dpi,
      thumbUrl: await thumbnail(bitmap),
    };
  } finally {
    bitmap.close();
  }
}

export interface LoadResult {
  images: NewImage[];
  failed: string[];
}

/** Carga las imágenes aceptadas, ordenadas por nombre; las que no se pueden leer van en `failed`. */
export async function loadImages(files: File[]): Promise<LoadResult> {
  const images: NewImage[] = [];
  const failed: string[] = [];
  for (const file of sortByName(files.filter(isAcceptedImage))) {
    try {
      images.push(await loadImage(file));
    } catch {
      failed.push(file.name);
    }
  }
  return { images, failed };
}
