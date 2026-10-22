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
  /** Tamaño de la primera página en puntos PDF. */
  firstPage?: { width: number; height: number };
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
    return {
      pages: doc.numPages,
      thumbUrl: blob ? URL.createObjectURL(blob) : null,
      firstPage: { width: base.width, height: base.height },
    };
  } catch {
    // Sin miniatura, pero se puede unir igualmente.
    return { pages: doc.numPages, thumbUrl: null };
  } finally {
    void doc.loadingTask.destroy();
  }
}

/**
 * Dibuja una miniatura de cada página, de una en una, y la entrega en cuanto está (URL de un Blob
 * que libera quien la recibe). Se para al abortar `signal`.
 */
export async function renderPageThumbnails(
  file: Blob,
  {
    height = 180,
    signal,
    onThumb,
  }: { height?: number; signal?: AbortSignal; onThumb: (page: number, url: string) => void },
): Promise<void> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    for (let n = 1; n <= doc.numPages && !signal?.aborted; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: height / base.height });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
      page.cleanup();
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
      canvas.width = 0;
      canvas.height = 0;
      if (blob && !signal?.aborted) onThumb(n, URL.createObjectURL(blob));
    }
  } finally {
    void doc.loadingTask.destroy();
  }
}
