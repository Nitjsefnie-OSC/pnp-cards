import { setJpegDpi } from '../lib/jpeg';
import { pagePixels } from '../lib/pageRange';
import { setPngDpi } from '../lib/png';
import { loadPdfjs } from './pdfjs';

export type RasterFormat = 'jpeg' | 'png';

export interface RasterOptions {
  dpi: number;
  format: RasterFormat;
  /** Páginas a convertir, desde 1. */
  pages: number[];
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export interface PageImage {
  name: string;
  blob: Blob;
  width: number;
  height: number;
}

const JPEG_QUALITY = 0.95;

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), type, quality),
  );

/**
 * Dibuja las páginas elegidas de un PDF con pdf.js y las devuelve como imágenes con sus ppp, de
 * una en una para no disparar la memoria. pdf.js aplica bien CMYK y las imágenes con /Decode, así
 * que los colores salen como en el PDF. Se llaman como en PDFCartas: «nombre_pag_1.jpg».
 */
export async function rasterizePdf(
  file: Blob,
  baseName: string,
  { dpi, format, pages, signal, onProgress }: RasterOptions,
): Promise<PageImage[]> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const images: PageImage[] = [];
  try {
    for (const [i, number] of pages.entries()) {
      if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
      const page = await doc.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const { width, height } = pagePixels(base, dpi);
      const viewport = page.getViewport({ scale: width / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      // Fondo blanco: el JPG no tiene transparencia y el PNG debe verse como en papel.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      page.cleanup();

      const encoded = new Uint8Array(
        await (await toBlob(canvas, `image/${format}`, JPEG_QUALITY)).arrayBuffer(),
      );
      // Libera la memoria del canvas enseguida (puede ocupar cientos de MB a 600 ppp).
      canvas.width = 0;
      canvas.height = 0;
      const withDpi = format === 'jpeg' ? setJpegDpi(encoded, dpi) : setPngDpi(encoded, dpi);
      images.push({
        name: `${baseName}_pag_${number}.${ext}`,
        blob: new Blob([withDpi as Uint8Array<ArrayBuffer>], { type: `image/${format}` }),
        width,
        height,
      });
      onProgress?.(i + 1, pages.length);
    }
  } finally {
    void doc.loadingTask.destroy();
  }
  return images;
}
