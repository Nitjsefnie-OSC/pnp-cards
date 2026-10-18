import { PDFDocument } from 'pdf-lib';

export interface PdfSource {
  name: string;
  data: Uint8Array | ArrayBuffer;
}

/** Un PDF de la lista no se ha podido leer (dañado, o protegido con contraseña). */
export class MergeError extends Error {
  constructor(readonly fileName: string) {
    super(`No se ha podido leer ${fileName}`);
    this.name = 'MergeError';
  }
}

/** Une todas las páginas de los PDF, en el orden dado, en un solo documento. */
export async function mergePdfs(
  sources: PdfSource[],
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  merged.setCreator('PnP Cards');
  merged.setProducer('PnP Cards (pdf-lib)');

  for (const [i, source] of sources.entries()) {
    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(source.data);
    } catch {
      throw new MergeError(source.name);
    }
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) merged.addPage(page);
    onProgress?.(i + 1, sources.length);
  }

  return merged.save();
}
