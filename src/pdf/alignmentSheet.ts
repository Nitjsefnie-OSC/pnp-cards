import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { resolveGrid } from '../lib/layout';
import type { LayoutSettings } from '../lib/settings';
import { mmToPt } from '../lib/units';

/** Textos de la hoja (ya traducidos; solo caracteres de WinAnsi, que es lo que admite Helvetica). */
export interface SheetTexts {
  title: string;
  /** Rótulo de cada página: «Página 1 · anverso», «Página 2 · reverso». */
  front: string;
  back: string;
  /** Volteo con el que se ha generado, para no confundirla con otra. */
  flip: string;
  /** Instrucciones del anverso, un párrafo por elemento. */
  stepsFront: string[];
  /** Instrucciones del reverso. */
  stepsBack: string[];
  /** Rótulo del cuadrado de comprobación («50 mm»). */
  square: string;
  /** Rótulos de las reglas: lo que hay que escribir en cada campo. */
  right: string;
  up: string;
}

const BLACK = rgb(0, 0, 0);
const TEXT = rgb(0.25, 0.25, 0.25);

/** Geometría de la hoja, en mm. */
const CROSS_ARM = 25;
const CIRCLE_RADIUS = 5;
const CORNER_INSET = 15;
const CORNER_ARM = 4;
const SQUARE_SIDE = 50;
const SQUARE_INSET = 20;
/** Las reglas van a esta distancia del centro, para no pisar la cruz ni el círculo. */
const RULER_GAP = 15;
const RULER_RANGE = 5;
const RULER_STEP = 0.5;

/** Margen de los textos: por dentro de las marcas de las esquinas. */
const MARGIN = mmToPt(25);
const TITLE_SIZE = 13;
const TEXT_SIZE = 9.5;
const LINE_HEIGHT = 13;

/** Parte un párrafo en líneas que quepan en `maxWidth` puntos. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number, thickness = 0.5) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: BLACK });
}

/** Cruz con los brazos de `arm` puntos. */
function cross(page: PDFPage, cx: number, cy: number, arm: number, thickness = 0.5) {
  line(page, cx - arm, cy, cx + arm, cy, thickness);
  line(page, cx, cy - arm, cx, cy + arm, thickness);
}

/**
 * Regla de ±5 mm en pasos de 0,5 mm, centrada en (cx, cy), horizontal (marcas hacia abajo) o
 * vertical (marcas hacia la derecha). Se rotula con el valor que habría que escribir si la línea
 * del anverso pasa por esa marca; el 0 es la propia línea de la cruz del reverso.
 */
function ruler(
  page: PDFPage,
  font: PDFFont,
  cx: number,
  cy: number,
  vertical: boolean,
  label: string,
) {
  const half = mmToPt(RULER_RANGE);
  const steps = Math.round((2 * RULER_RANGE) / RULER_STEP);
  if (vertical) line(page, cx, cy - half, cx, cy + half);
  else line(page, cx - half, cy, cx + half, cy);
  for (let i = 0; i <= steps; i++) {
    const mm = -RULER_RANGE + i * RULER_STEP;
    const offset = mmToPt(mm);
    const whole = Number.isInteger(mm);
    const tick = mmToPt(mm === 0 ? 4 : whole ? 3 : 1.5);
    if (vertical) line(page, cx, cy + offset, cx + tick, cy + offset, whole ? 0.5 : 0.3);
    else line(page, cx + offset, cy, cx + offset, cy - tick, whole ? 0.5 : 0.3);
  }
  const size = 7;
  const text = (value: number) => (value > 0 ? `+${value}` : String(value));
  for (const mm of [-RULER_RANGE, 0, RULER_RANGE]) {
    const offset = mmToPt(mm);
    const t = text(mm);
    const width = font.widthOfTextAtSize(t, size);
    // El 0 se aparta un poco de la línea de la cruz para que se lea.
    const nudge = mm === 0 ? mmToPt(0.8) : 0;
    if (vertical) {
      page.drawText(t, {
        x: cx + mmToPt(5.5),
        y: cy + offset - size / 3 + nudge,
        size,
        font,
        color: TEXT,
      });
    } else {
      page.drawText(t, {
        x: cx + offset - width / 2 + nudge,
        y: cy - mmToPt(5.5) - size,
        size,
        font,
        color: TEXT,
      });
    }
  }
  const captionSize = 8;
  if (vertical) {
    page.drawText(label, {
      x: cx + mmToPt(12),
      y: cy - font.widthOfTextAtSize(label, captionSize) / 2,
      size: captionSize,
      font,
      color: TEXT,
      rotate: degrees(90),
    });
  } else {
    page.drawText(label, {
      x: cx - font.widthOfTextAtSize(label, captionSize) / 2,
      y: cy - mmToPt(10.5) - captionSize,
      size: captionSize,
      font,
      color: TEXT,
    });
  }
}

/**
 * Hoja de prueba de alineación: dos páginas del tamaño de página configurado. En la primera, una
 * cruz en el centro, marcas en las esquinas y un cuadrado de 50 mm (para comprobar que se
 * imprime al 100 %). En la segunda, la misma cruz en espejo según el volteo, con dos reglas que
 * dicen directamente qué escribir en «Mover reverso a la derecha» y «hacia arriba». Se genera
 * sin el desplazamiento actual, para que el valor leído sea el que hay que escribir.
 */
export async function buildAlignmentSheet(
  settings: LayoutSettings,
  texts: SheetTexts,
): Promise<Uint8Array> {
  const { width: W, height: H } = resolveGrid(settings).page;
  const long = settings.backs.flip === 'long';
  const doc = await PDFDocument.create();
  doc.setCreator('PnP Cards');
  doc.setProducer('PnP Cards (pdf-lib)');
  doc.setTitle(texts.title);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const cx = W / 2;
  const cy = H / 2;

  for (const side of ['front', 'back'] as const) {
    const page = doc.addPage([W, H]);
    const isBack = side === 'back';

    // Textos arriba: título, página y volteo, y las instrucciones.
    let y = H - MARGIN - TITLE_SIZE;
    page.drawText(`${texts.title} · ${isBack ? texts.back : texts.front}`, {
      x: MARGIN,
      y,
      size: TITLE_SIZE,
      font: bold,
      color: BLACK,
    });
    y -= LINE_HEIGHT + 2;
    page.drawText(texts.flip, { x: MARGIN, y, size: TEXT_SIZE, font, color: TEXT });
    y -= LINE_HEIGHT;
    for (const step of isBack ? texts.stepsBack : texts.stepsFront) {
      y -= 4;
      for (const l of wrap(step, font, TEXT_SIZE, W - 2 * MARGIN)) {
        page.drawText(l, { x: MARGIN, y, size: TEXT_SIZE, font, color: TEXT });
        y -= LINE_HEIGHT;
      }
    }

    // Cruz central con círculo y marcas en las esquinas (todas simétricas: el espejo no las mueve).
    cross(page, cx, cy, mmToPt(CROSS_ARM));
    page.drawCircle({
      x: cx,
      y: cy,
      size: mmToPt(CIRCLE_RADIUS),
      borderColor: BLACK,
      borderWidth: 0.5,
    });
    const inset = mmToPt(CORNER_INSET);
    for (const x of [inset, W - inset]) {
      for (const yy of [inset, H - inset]) cross(page, x, yy, mmToPt(CORNER_ARM));
    }

    // Cuadrado de 50 mm abajo a la izquierda; en el reverso, donde cae al dar la vuelta a la hoja.
    const side50 = mmToPt(SQUARE_SIDE);
    const squareInset = mmToPt(SQUARE_INSET);
    const sx = isBack && long ? W - squareInset - side50 : squareInset;
    const sy = isBack && !long ? H - squareInset - side50 : squareInset;
    page.drawRectangle({
      x: sx,
      y: sy,
      width: side50,
      height: side50,
      borderColor: BLACK,
      borderWidth: 0.5,
      borderDashArray: [3, 3],
    });
    page.drawText(texts.square, {
      x: sx + side50 + mmToPt(2),
      y: sy + side50 / 2 - 3,
      size: 8,
      font,
      color: TEXT,
    });

    if (isBack) {
      ruler(page, font, cx, cy - mmToPt(RULER_GAP), false, texts.right);
      ruler(page, font, cx + mmToPt(RULER_GAP), cy, true, texts.up);
    }
  }

  return doc.save();
}
