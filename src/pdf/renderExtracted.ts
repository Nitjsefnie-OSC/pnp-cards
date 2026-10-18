import type { Analysis } from './extractImages';
import { loadPdfjs } from './pdfjs';

export interface ExtractedImage {
  /** «nombre_img_3 x9.png»: con « xN» si se repite, para que Cartas ponga esas copias. */
  name: string;
  blob: Blob;
  width: number;
  height: number;
  count: number;
}

/** Nombre de una imagen extraída, como en PDFCartas, con las veces que aparece. */
export function extractedName(base: string, index: number, count: number, ext: string) {
  return `${base}_img_${index + 1}${count > 1 ? ` x${count}` : ''}.${ext}`;
}

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'),
  );

/**
 * Convierte el análisis en archivos: los JPEG tal cual y el resto dibujado por pdf.js a su tamaño
 * (1 pt = 1 px) sobre fondo transparente, en PNG sin pérdida.
 */
export async function renderExtracted(
  analysis: Analysis,
  base: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ExtractedImage[]> {
  const pdfjs = analysis.renderPdf ? await loadPdfjs() : null;
  const doc =
    analysis.renderPdf && pdfjs
      ? await pdfjs.getDocument({ data: analysis.renderPdf }).promise
      : null;
  const result: ExtractedImage[] = [];
  try {
    for (const [i, img] of analysis.images.entries()) {
      let blob: Blob;
      if (img.kind === 'jpeg' && img.bytes) {
        blob = new Blob([img.bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' });
      } else {
        const page = await doc!.getPage(img.renderPage! + 1);
        const viewport = page.getViewport({ scale: 1 });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        await page.render({
          canvas,
          canvasContext: canvas.getContext('2d')!,
          viewport,
          background: 'rgba(0,0,0,0)',
        }).promise;
        page.cleanup();
        blob = await toBlob(canvas);
        canvas.width = 0;
        canvas.height = 0;
      }
      const ext = img.kind === 'jpeg' ? 'jpg' : 'png';
      result.push({
        name: extractedName(base, i, img.count, ext),
        blob,
        width: img.width,
        height: img.height,
        count: img.count,
      });
      onProgress?.(i + 1, analysis.images.length);
    }
  } finally {
    if (doc) void doc.loadingTask.destroy();
  }
  return result;
}
