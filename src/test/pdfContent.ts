import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from 'pdf-lib';

/** Operadores de dibujo de una página de un PDF generado, como texto (solo para tests). */
export function pageContent(doc: PDFDocument, index: number) {
  const contents = doc.getPage(index).node.Contents();
  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((r) => doc.context.lookup(r))
      : [contents];
  return streams
    .map((s) => new TextDecoder().decode(decodePDFRawStream(s as PDFRawStream).decode()))
    .join('\n');
}
