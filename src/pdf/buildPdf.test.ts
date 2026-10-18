// @vitest-environment node
import { readFileSync } from 'node:fs';
import { decodePDFRawStream, PDFArray, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { DEFAULT_SETTINGS } from '../lib/settings';
import { buildPdf, type PdfCard } from './buildPdf';

const fixture = (name: string) =>
  Uint8Array.from(readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url)));
const jpg = fixture('card.jpg');
const png = fixture('card.png');

const card = (
  bytes: Uint8Array<ArrayBuffer>,
  format: PdfCard['format'],
  copies: number,
): PdfCard => ({
  data: new Blob([bytes]),
  format,
  widthPx: 30,
  heightPx: 42,
  dpi: { x: 300, y: 300 },
  copies,
});

function imageStreams(doc: PDFDocument) {
  return doc.context
    .enumerateIndirectObjects()
    .map(([, obj]) => obj)
    .filter(
      (obj): obj is PDFRawStream =>
        obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'),
    );
}

/** Operadores de dibujo de una página, como texto. */
function pageContent(doc: PDFDocument, index: number) {
  const contents = doc.getPage(index).node.Contents();
  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((r) => doc.context.lookup(r))
      : [contents];
  return streams
    .map((s) => new TextDecoder().decode(decodePDFRawStream(s as PDFRawStream).decode()))
    .join('\n');
}

describe('buildPdf', () => {
  it('genera una página por cada nueve cartas en A4 vertical', async () => {
    const bytes = await buildPdf({
      settings: DEFAULT_SETTINGS,
      cards: [card(jpg, 'jpeg', 10), card(png, 'png', 1)],
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize()).toEqual({ width: 595, height: 842 });
  });

  it('incrusta cada imagen una sola vez, aunque tenga muchas copias', async () => {
    const doc = await PDFDocument.load(
      await buildPdf({
        settings: DEFAULT_SETTINGS,
        cards: [card(jpg, 'jpeg', 12), card(png, 'png', 5)],
      }),
    );
    expect(imageStreams(doc)).toHaveLength(2);
  });

  it('incrusta el JPG tal cual, sin volver a codificarlo', async () => {
    const doc = await PDFDocument.load(
      await buildPdf({ settings: DEFAULT_SETTINGS, cards: [card(jpg, 'jpeg', 1)] }),
    );
    const [stream] = imageStreams(doc);
    expect(stream.dict.get(PDFName.of('Filter'))).toBe(PDFName.of('DCTDecode'));
    expect(stream.getContents()).toEqual(jpg);
  });

  it('las imágenes en blanco no incrustan ninguna imagen', async () => {
    const blank: PdfCard = { ...card(jpg, 'jpeg', 2), data: null };
    const doc = await PDFDocument.load(
      await buildPdf({ settings: DEFAULT_SETTINGS, cards: [card(png, 'png', 1), blank] }),
    );
    expect(imageStreams(doc)).toHaveLength(1);
  });

  it('informa del progreso carta a carta hasta el total', async () => {
    const progress: number[] = [];
    await buildPdf({ settings: DEFAULT_SETTINGS, cards: [card(png, 'png', 3)] }, (done, total) =>
      progress.push(done / total),
    );
    expect(progress.at(-1)).toBe(1);
    expect(progress).toHaveLength(3);
  });

  it('guarda el título y el creador en los metadatos', async () => {
    const doc = await PDFDocument.load(
      await buildPdf({ settings: DEFAULT_SETTINGS, cards: [card(png, 'png', 1)], title: 'Cartas' }),
    );
    expect(doc.getTitle()).toBe('Cartas');
    expect(doc.getCreator()).toBe('PnP Cards');
  });

  it('recorta sin volver a codificar: el JPG sigue intacto y la página lleva una máscara', async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      crop: { enabled: true, widthMm: 2, heightMm: 3, centered: true, x: 0, y: 0 },
    };
    const doc = await PDFDocument.load(await buildPdf({ settings, cards: [card(jpg, 'jpeg', 2)] }));
    const [stream] = imageStreams(doc);
    expect(stream.getContents()).toEqual(jpg);

    // re = rectángulo, W n = usarlo como máscara de recorte.
    expect(pageContent(doc, 0)).toMatch(/re\s+W\s+n/);
  });

  it('con plantilla, gira la carta en su hueco sin volver a codificarla', async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      mode: 'template' as const,
      template: {
        id: 't',
        name: 'x',
        pageMm: { width: 100, height: 100 },
        slots: [{ id: 'a', xMm: 10, yMm: 10, widthMm: 40, heightMm: 30, rotation: 90 as const }],
      },
    };
    const doc = await PDFDocument.load(await buildPdf({ settings, cards: [card(jpg, 'jpeg', 1)] }));
    expect(imageStreams(doc)[0].getContents()).toEqual(jpg);
    const content = pageContent(doc, 0);
    // Recorte al hueco y matriz de giro de 90°: 0 1 -1 0 e f cm.
    expect(content).toMatch(/re\s+W\s+n/);
    expect(content).toMatch(/\b0 1 -1 0 [\d.]+ [\d.]+ cm/);
  });
});
