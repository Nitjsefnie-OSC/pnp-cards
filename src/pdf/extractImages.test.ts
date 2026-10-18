// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PDFArray, PDFDocument, PDFName, PDFNumber } from 'pdf-lib';
import { analyzeImages } from './extractImages';

const fixture = (name: string) =>
  Uint8Array.from(readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url)));
const jpg = fixture('card.jpg');
const png = fixture('card.png');
const all = { minSize: 0 };

/** Dibuja la imagen en la página en una rejilla de `times` huecos. */
function drawTimes(
  page: ReturnType<PDFDocument['addPage']>,
  img: Parameters<typeof page.drawImage>[0],
  times: number,
) {
  for (let i = 0; i < times; i++)
    page.drawImage(img, { x: 10 + (i % 3) * 40, y: 10 + Math.floor(i / 3) * 50 });
}

describe('analyzeImages', () => {
  it('cuenta cuántas veces se pinta cada imagen y saca los JPEG tal cual', async () => {
    const doc = await PDFDocument.create();
    const img = await doc.embedJpg(jpg);
    drawTimes(doc.addPage([200, 200]), img, 9);
    drawTimes(doc.addPage([200, 200]), img, 1);

    const { images } = await analyzeImages(await doc.save(), all);
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ count: 10, width: 30, height: 42, kind: 'jpeg' });
    expect(images[0].bytes).toEqual(jpg);
  });

  it('junta las imágenes repetidas aunque estén incrustadas por separado', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    page.drawImage(await doc.embedJpg(jpg), { x: 0, y: 0 });
    page.drawImage(await doc.embedJpg(jpg), { x: 50, y: 0 });

    const { images } = await analyzeImages(await doc.save(), all);
    expect(images.map((i) => i.count)).toEqual([2]);
  });

  it('las imágenes que no son JPEG normales se dibujan aparte, a su tamaño, para decodificarlas bien', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    page.drawImage(await doc.embedJpg(jpg), { x: 0, y: 0 });
    page.drawImage(await doc.embedPng(png), { x: 50, y: 0 });

    const { images, renderPdf } = await analyzeImages(await doc.save(), all);
    expect(images.map((i) => i.kind)).toEqual(['jpeg', 'render']);
    expect(images[1]).toMatchObject({ renderPage: 0, width: 30, height: 42 });
    const temp = await PDFDocument.load(renderPdf!);
    expect(temp.getPages().map((p) => [p.getWidth(), p.getHeight()])).toEqual([[30, 42]]);
  });

  it('un JPEG con /Decode (colores invertidos en el PDF) no se copia tal cual', async () => {
    const doc = await PDFDocument.create();
    const img = await doc.embedJpg(jpg);
    doc.addPage([200, 200]).drawImage(img, { x: 0, y: 0 });
    await doc.flush();
    const stream = doc.context.lookup(img.ref) as unknown as {
      dict: { set: (k: PDFName, v: PDFArray) => void };
    };
    stream.dict.set(
      PDFName.of('Decode'),
      doc.context.obj([1, 0, 1, 0, 1, 0].map((n) => PDFNumber.of(n))) as PDFArray,
    );

    const { images } = await analyzeImages(await doc.save(), all);
    expect(images[0].kind).toBe('render');
  });

  it('cuenta también las imágenes dentro de formularios (páginas incrustadas)', async () => {
    const src = await PDFDocument.create();
    src.addPage([100, 100]).drawImage(await src.embedJpg(jpg), { x: 0, y: 0 });
    const doc = await PDFDocument.create();
    const [form] = await doc.embedPdf(await src.save());
    const page = doc.addPage([300, 300]);
    page.drawPage(form, { x: 0, y: 0 });
    page.drawPage(form, { x: 150, y: 0 });

    const { images } = await analyzeImages(await doc.save(), all);
    expect(images.map((i) => i.count)).toEqual([2]);
  });

  it('ignora las imágenes más pequeñas que el tamaño mínimo', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]).drawImage(await doc.embedJpg(jpg), { x: 0, y: 0 });

    const result = await analyzeImages(await doc.save(), { minSize: 100 });
    expect(result.images).toEqual([]);
    expect(result.skipped).toBe(1);
  });

  it('las ordena por su primera aparición e informa del progreso por página', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]).drawImage(await doc.embedPng(png), { x: 0, y: 0 });
    doc.addPage([200, 200]).drawImage(await doc.embedJpg(jpg), { x: 0, y: 0 });
    const progress: number[] = [];

    const { images } = await analyzeImages(await doc.save(), {
      minSize: 0,
      onProgress: (d) => progress.push(d),
    });
    expect(images.map((i) => i.kind)).toEqual(['render', 'jpeg']);
    expect(progress).toEqual([1, 2]);
  });
});
