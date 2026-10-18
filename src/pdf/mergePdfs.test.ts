// @vitest-environment node
import { PDFDocument } from 'pdf-lib';
import { mergePdfs, MergeError } from './mergePdfs';

/** PDF de prueba con páginas de los tamaños dados. */
async function pdf(...sizes: [number, number][]) {
  const doc = await PDFDocument.create();
  for (const size of sizes) doc.addPage(size);
  return doc.save();
}

describe('mergePdfs', () => {
  it('une las páginas de todos los PDF en el orden dado', async () => {
    const a = await pdf([595, 842], [595, 842]);
    const b = await pdf([842, 595], [300, 400], [100, 100]);
    const merged = await PDFDocument.load(
      await mergePdfs([
        { name: 'b.pdf', data: b },
        { name: 'a.pdf', data: a },
      ]),
    );
    expect(merged.getPages().map((p) => [p.getWidth(), p.getHeight()])).toEqual([
      [842, 595],
      [300, 400],
      [100, 100],
      [595, 842],
      [595, 842],
    ]);
  });

  it('informa del progreso archivo a archivo', async () => {
    const progress: [number, number][] = [];
    await mergePdfs(
      [
        { name: 'a.pdf', data: await pdf([10, 10]) },
        { name: 'b.pdf', data: await pdf([10, 10]) },
      ],
      (done, total) => progress.push([done, total]),
    );
    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it('dice qué archivo no se ha podido leer', async () => {
    const err = await mergePdfs([
      { name: 'bueno.pdf', data: await pdf([10, 10]) },
      { name: 'roto.pdf', data: new TextEncoder().encode('no es un pdf') },
    ]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MergeError);
    expect(err).toMatchObject({ fileName: 'roto.pdf' });
  });

  it('guarda el creador en los metadatos', async () => {
    const merged = await PDFDocument.load(
      await mergePdfs([{ name: 'a.pdf', data: await pdf([10, 10]) }]),
    );
    expect(merged.getCreator()).toBe('PnP Cards');
  });
});
