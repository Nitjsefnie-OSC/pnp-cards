import type * as Pdfjs from 'pdfjs-dist';

let pdfjsPromise: Promise<typeof Pdfjs> | null = null;

/** pdf.js solo se descarga cuando una herramienta lo necesita. */
export function loadPdfjs(): Promise<typeof Pdfjs> {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
}

export interface PdfInfo {
  pages: number;
  /** Miniatura de la primera página (URL de un Blob). */
  thumbUrl: string | null;
}

/** El PDF está dañado o protegido con contraseña. */
export class UnreadablePdfError extends Error {
  constructor() {
    super('unreadable');
    this.name = 'UnreadablePdfError';
  }
}

/** Número de páginas y miniatura de la primera página de un PDF. */
export async function inspectPdf(file: Blob, thumbHeight = 160): Promise<PdfInfo> {
  const pdfjs = await loadPdfjs();
  let doc: Pdfjs.PDFDocumentProxy;
  try {
    // pdf.js se queda con el buffer: se le pasa una copia.
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch {
    throw new UnreadablePdfError();
  }
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: thumbHeight / base.height });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
    return { pages: doc.numPages, thumbUrl: blob ? URL.createObjectURL(blob) : null };
  } catch {
    // Sin miniatura, pero se puede unir igualmente.
    return { pages: doc.numPages, thumbUrl: null };
  } finally {
    void doc.loadingTask.destroy();
  }
}
