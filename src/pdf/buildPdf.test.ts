// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { DEFAULT_SETTINGS } from '../lib/settings';
import { pageContent } from '../test/pdfContent';
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

  describe('con reversos', () => {
    const back = { data: new Blob([png]), format: 'png' as const, widthPx: 30, heightPx: 30 };
    const withBacks = (flip: 'long' | 'short') => ({
      ...DEFAULT_SETTINGS,
      backs: { enabled: true, flip },
    });

    it('intercala una página de reversos tras cada página de cartas', async () => {
      const doc = await PDFDocument.load(
        await buildPdf({
          settings: withBacks('long'),
          cards: [card(jpg, 'jpeg', 10)],
          back,
        }),
      );
      expect(doc.getPageCount()).toBe(4);
      // Do = dibujar una imagen: 9 reversos en la página 2 y 1 en la 4.
      expect(pageContent(doc, 1).match(/\bDo\b/g)).toHaveLength(9);
      expect(pageContent(doc, 3).match(/\bDo\b/g)).toHaveLength(1);
    });

    it('incrusta el reverso una sola vez y sin volver a codificarlo', async () => {
      const doc = await PDFDocument.load(
        await buildPdf({ settings: withBacks('long'), cards: [card(jpg, 'jpeg', 12)], back }),
      );
      expect(imageStreams(doc)).toHaveLength(2);
    });

    it('por el borde corto, gira el reverso media vuelta: -1 0 0 -1 e f cm', async () => {
      const doc = await PDFDocument.load(
        await buildPdf({ settings: withBacks('short'), cards: [card(jpg, 'jpeg', 1)], back }),
      );
      expect(pageContent(doc, 1)).toMatch(/-1 0 0 -1 [\d.]+ [\d.]+ cm/);
    });

    it('el progreso cuenta solo las cartas', async () => {
      const progress: [number, number][] = [];
      await buildPdf(
        { settings: withBacks('long'), cards: [card(png, 'png', 3)], back },
        (done, total) => progress.push([done, total]),
      );
      expect(progress.at(-1)).toEqual([3, 3]);
      expect(progress).toHaveLength(3);
    });
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

  describe('cabecera', () => {
    /** Textos dibujados en una página (cadenas hexadecimales de los operadores Tj, en WinAnsi). */
    function texts(doc: PDFDocument, index: number) {
      return [...pageContent(doc, index).matchAll(/<([0-9A-Fa-f]+)> Tj/g)].map((m) =>
        String.fromCharCode(...(m[1].match(/../g) ?? []).map((h) => parseInt(h, 16))),
      );
    }

    it('sin la opción no dibuja texto', async () => {
      const doc = await PDFDocument.load(
        await buildPdf({
          settings: DEFAULT_SETTINGS,
          cards: [card(jpg, 'jpeg', 1)],
          header: { name: 'Dragones', pageLabel: 'Página {{n}} de {{total}}' },
        }),
      );
      expect(texts(doc, 0)).toEqual([]);
    });

    it('escribe el nombre y el número de hoja en cada página de cartas, en Helvetica', async () => {
      const doc = await PDFDocument.load(
        await buildPdf({
          settings: { ...DEFAULT_SETTINGS, header: true },
          cards: [card(jpg, 'jpeg', 10)],
          header: { name: 'Dragones del valle', pageLabel: 'Página {{n}} de {{total}}' },
        }),
      );
      expect(texts(doc, 0)).toEqual(['Dragones del valle', 'P\xe1gina 1 de 2']);
      expect(texts(doc, 1)).toEqual(['Dragones del valle', 'P\xe1gina 2 de 2']);
      expect(pageContent(doc, 0)).toMatch(/\/[\w-]+ 7 Tf/);
      const fonts = doc.context
        .enumerateIndirectObjects()
        .map(([, obj]) => obj)
        .filter(
          (obj): obj is PDFDict =>
            obj instanceof PDFDict && obj.get(PDFName.of('Type')) === PDFName.of('Font'),
        );
      expect(fonts).toHaveLength(1);
      expect(String(fonts[0].get(PDFName.of('BaseFont')))).toBe('/Helvetica');
    });

    it('con reversos, las páginas de reversos no llevan cabecera y las hojas se numeran seguidas', async () => {
      const doc = await PDFDocument.load(
        await buildPdf({
          settings: { ...DEFAULT_SETTINGS, header: true, backs: { enabled: true, flip: 'long' } },
          cards: [card(jpg, 'jpeg', 10)],
          back: { data: new Blob([png]), format: 'png', widthPx: 30, heightPx: 42 },
          header: { name: 'Dragones', pageLabel: 'Hoja {{n}} de {{total}}' },
        }),
      );
      expect(doc.getPageCount()).toBe(4);
      expect(texts(doc, 0)).toEqual(['Dragones', 'Hoja 1 de 2']);
      expect(texts(doc, 1)).toEqual([]);
      expect(texts(doc, 2)).toEqual(['Dragones', 'Hoja 2 de 2']);
    });

    it('sustituye los caracteres que Helvetica no tiene', async () => {
      const doc = await PDFDocument.load(
        await buildPdf({
          settings: { ...DEFAULT_SETTINGS, header: true },
          cards: [card(jpg, 'jpeg', 1)],
          header: { name: 'Smoków \u{1F409} Wałęsa', pageLabel: '{{n}}/{{total}}' },
        }),
      );
      expect(texts(doc, 0)).toEqual(['Smok\xf3w ? Wa??sa', '1/1']);
    });

    it('en el lateral, el texto va girado 90°', async () => {
      // Cartas pegadas de 63,5 × 99 mm: tres filas llenan la hoja y solo quedan los laterales.
      const tall = { ...card(jpg, 'jpeg', 1), widthPx: 750, heightPx: 1169 };
      const doc = await PDFDocument.load(
        await buildPdf({
          settings: { ...DEFAULT_SETTINGS, header: true, mode: 'manual', placement: 'together' },
          cards: [tall],
          header: { name: 'Dragones', pageLabel: '{{n}}/{{total}}' },
        }),
      );
      // Matriz de texto de un giro de 90° antihorario: [cos sin -sin cos x y] con cos ≈ 0.
      const matrices = [...pageContent(doc, 0).matchAll(/^(\S+) 1 -1 (\S+) \S+ \S+ Tm$/gm)];
      expect(matrices).toHaveLength(2);
      for (const m of matrices) expect(Math.abs(Number(m[1]))).toBeLessThan(1e-9);
    });
  });
});
