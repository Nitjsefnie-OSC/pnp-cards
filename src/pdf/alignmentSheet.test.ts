// @vitest-environment node
import { PDFDocument } from 'pdf-lib';
import en from '../i18n/en.json';
import es from '../i18n/es.json';
import { DEFAULT_SETTINGS, type LayoutSettings } from '../lib/settings';
import { pageContent } from '../test/pdfContent';
import { buildAlignmentSheet, type SheetTexts } from './alignmentSheet';

type Sheet = typeof es.sheet;

/** Los textos reales de un idioma, como los pasa la interfaz. */
const textsOf = (sheet: Sheet, flip: string): SheetTexts => ({
  title: sheet.title,
  front: sheet.front,
  back: sheet.back,
  flip,
  stepsFront: [sheet.step1, sheet.step2, sheet.step3, sheet.step4],
  stepsBack: [sheet.backStep],
  square: sheet.square,
  right: sheet.right,
  up: sheet.up,
});
const texts = textsOf(es.sheet, es.sheet.flipLong);

const withFlip = (flip: 'long' | 'short', over: Partial<LayoutSettings> = {}): LayoutSettings => ({
  ...DEFAULT_SETTINGS,
  ...over,
  backs: { enabled: true, flip },
});

const lines = (content: string) => content.match(/\bl\b/g)?.length ?? 0;

describe('buildAlignmentSheet', () => {
  it('son dos páginas del tamaño de página configurado', async () => {
    const doc = await PDFDocument.load(
      await buildAlignmentSheet(withFlip('long', { mode: 'horizontal8' }), texts),
    );
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize()).toEqual({ width: 842, height: 595 });
    expect(doc.getPage(1).getSize()).toEqual({ width: 842, height: 595 });
    expect(doc.getTitle()).toBe('Hoja de prueba de alineación');
  });

  it('lleva un cuadrado de 50 mm (141,73 pt) para comprobar la escala', async () => {
    const doc = await PDFDocument.load(await buildAlignmentSheet(withFlip('long'), texts));
    // 20 mm desde la esquina inferior izquierda: 56,69 pt; pdf-lib traslada y traza el contorno.
    const content = pageContent(doc, 0);
    expect(content).toMatch(/1 0 0 1 56\.69\d* 56\.69\d* cm/);
    expect(content).toMatch(/141\.73\d* 141\.73\d* l/);
  });

  it('en el reverso, el cuadrado va en espejo según el volteo', async () => {
    const long = await PDFDocument.load(await buildAlignmentSheet(withFlip('long'), texts));
    // Por el borde largo se refleja en horizontal: 595 − 56,69 − 141,73 = 396,57.
    expect(pageContent(long, 1)).toMatch(/1 0 0 1 396\.57\d* 56\.69\d* cm/);
    const short = await PDFDocument.load(await buildAlignmentSheet(withFlip('short'), texts));
    // Por el borde corto, en vertical: 842 − 56,69 − 141,73 = 643,57.
    expect(pageContent(short, 1)).toMatch(/1 0 0 1 56\.69\d* 643\.57\d* cm/);
  });

  it('el reverso añade dos reglas de ±5 mm en pasos de 0,5 mm', async () => {
    const doc = await PDFDocument.load(await buildAlignmentSheet(withFlip('long'), texts));
    // Cada regla: su línea y 21 marcas; 44 segmentos más que en el anverso.
    expect(lines(pageContent(doc, 1)) - lines(pageContent(doc, 0))).toBe(44);
  });

  it('la cruz central pasa por el centro de la página en las dos caras', async () => {
    const doc = await PDFDocument.load(await buildAlignmentSheet(withFlip('short'), texts));
    for (const i of [0, 1]) {
      // Brazo horizontal de 25 mm (70,87 pt) a cada lado de (297,5, 421).
      expect(pageContent(doc, i)).toMatch(/226\.63\d* 421 m\s+368\.36\d* 421 l/);
    }
  });

  it('los textos de los dos idiomas se pueden escribir con la fuente estándar', async () => {
    await expect(
      buildAlignmentSheet(withFlip('long'), textsOf(es.sheet, es.sheet.flipShort)),
    ).resolves.toBeInstanceOf(Uint8Array);
    await expect(
      buildAlignmentSheet(withFlip('short'), textsOf(en.sheet, en.sheet.flipLong)),
    ).resolves.toBeInstanceOf(Uint8Array);
  });
});
