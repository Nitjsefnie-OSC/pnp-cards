import {
  PDFDocument,
  StandardFonts,
  clip,
  concatTransformationMatrix,
  degrees,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import { imageDrawRect } from '../lib/crop';
import type { Dpi } from '../lib/dpi';
import type { HeaderPlacement } from '../lib/header';
import { planDocument } from '../lib/plan';
import { slotLocalSize, slotMatrix } from '../lib/template';
import type { LayoutSettings } from '../lib/settings';

export interface PdfCard {
  /** null en una imagen en blanco. */
  data: Blob | null;
  format: 'jpeg' | 'png';
  widthPx: number;
  heightPx: number;
  dpi: Dpi | null;
  copies: number;
  /** La carta no lleva reverso (con los reversos activados). */
  noBack?: boolean;
}

/** Imagen del reverso común: se ajusta a cada hueco, así que no importan sus ppp. */
export interface PdfBack {
  data: Blob;
  format: 'jpeg' | 'png';
  widthPx: number;
  heightPx: number;
}

/** Textos de la cabecera (ya traducidos): el nombre y el rótulo del número de hoja. */
export interface HeaderTexts {
  name: string;
  /** Con «{{n}}» y «{{total}}», que se sustituyen en cada página. */
  pageLabel: string;
}

export interface BuildInput {
  settings: LayoutSettings;
  cards: PdfCard[];
  /** Obligatorio con los reversos activados. */
  back?: PdfBack | null;
  title?: string;
  /** Obligatorio con la cabecera activada (`settings.header`). */
  header?: HeaderTexts | null;
}

export type ProgressHandler = (done: number, total: number) => void;

const HEADER_COLOR = rgb(0.48, 0.48, 0.48);

/** Sustituye por «?» los caracteres que la fuente no puede codificar (Helvetica solo tiene WinAnsi). */
function encodable(text: string, font: PDFFont) {
  return [...text.normalize('NFC')]
    .map((ch) => {
      try {
        font.encodeText(ch);
        return ch;
      } catch {
        return '?';
      }
    })
    .join('');
}

/**
 * Cabecera de una página: el nombre desde `start` y el número de hoja terminando en `end`,
 * sobre la misma línea base; en el lateral, girados 90° (y entonces el ancho del texto corre
 * hacia arriba).
 */
function drawHeader(
  page: PDFPage,
  font: PDFFont,
  placement: HeaderPlacement,
  name: string,
  label: string,
) {
  const { size, rotation, start, end } = placement;
  const common = { size, font, color: HEADER_COLOR, rotate: degrees(rotation) };
  page.drawText(name, { ...common, x: start.x, y: start.y });
  const width = font.widthOfTextAtSize(label, size);
  page.drawText(label, {
    ...common,
    x: rotation === 90 ? end.x : end.x - width,
    y: rotation === 90 ? end.y - width : end.y,
  });
}

function hexToRgb(hex: string) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((d) => d + d).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return rgb(((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255);
}

/**
 * Genera el PDF de cartas. Cada imagen se incrusta una sola vez y se reutiliza en todas sus
 * copias; JPG y PNG van tal cual, sin volver a codificarlos, también al recortar.
 */
export async function buildPdf(
  input: BuildInput,
  onProgress?: ProgressHandler,
): Promise<Uint8Array> {
  const { settings, cards, back = null } = input;
  const plan = planDocument(
    settings,
    cards.map((c) => ({ ...c, blank: c.data === null })),
    back,
  );

  const doc = await PDFDocument.create();
  doc.setCreator('PnP Cards');
  doc.setProducer('PnP Cards (pdf-lib)');
  if (input.title) doc.setTitle(input.title);

  const embedded = new Map<PdfCard | PdfBack, PDFImage>();
  async function image(source: PdfCard | PdfBack): Promise<PDFImage | null> {
    if (!source.data) return null;
    let img = embedded.get(source);
    if (!img) {
      const bytes = new Uint8Array(await source.data.arrayBuffer());
      img = source.format === 'jpeg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
      embedded.set(source, img);
    }
    return img;
  }

  const bleedColor = hexToRgb(settings.bleed.color);
  const lineColor = hexToRgb(settings.cutLines.color);
  // La fuente solo se incrusta si alguna página lleva cabecera.
  const header =
    input.header && plan.pages.some((p) => p.header !== null)
      ? { font: await doc.embedFont(StandardFonts.Helvetica), texts: input.header }
      : null;
  const headerName = header ? encodable(header.texts.name, header.font) : '';
  let done = 0;

  for (const planned of plan.pages) {
    const page: PDFPage = doc.addPage([planned.size.width, planned.size.height]);

    // El margen de corte va debajo de las cartas.
    for (const r of planned.bleed) {
      page.drawRectangle({ ...r, color: bleedColor });
    }

    // En una página de reversos, cada hueco lleva la imagen del reverso con su propio recorte.
    const isBack = planned.side === 'back';
    for (const { card, placement, crop, rotation } of planned.items) {
      const source = isBack ? back! : cards[card];
      const img = await image(source);
      if (img && rotation !== undefined) {
        // Plantilla: se recorta al hueco y se gira el sistema de coordenadas; dentro, la carta
        // se dibuja sin girar (y con su recorte, si lo hay) de 0,0 a su tamaño.
        const { x, y, width, height } = placement;
        const local = { x: 0, y: 0, ...slotLocalSize(placement, rotation) };
        const [a, b, c, d, e, f] = slotMatrix(placement, rotation);
        page.pushOperators(
          pushGraphicsState(),
          rectangle(x, y, width, height),
          clip(),
          endPath(),
          concatTransformationMatrix(a, b, c, d, e, f),
        );
        page.drawImage(img, crop ? imageDrawRect(local, crop, source) : local);
        page.pushOperators(popGraphicsState());
      } else if (img && crop) {
        // Se dibuja la imagen entera y una máscara del tamaño del hueco oculta lo recortado.
        const { x, y, width, height } = placement;
        page.pushOperators(pushGraphicsState(), rectangle(x, y, width, height), clip(), endPath());
        page.drawImage(img, imageDrawRect(placement, crop, source));
        page.pushOperators(popGraphicsState());
      } else if (img) {
        page.drawImage(img, placement);
      }
      if (isBack) continue;
      done += 1;
      onProgress?.(done, plan.total);
    }

    if (planned.header && header) {
      const label = header.texts.pageLabel
        .replace('{{n}}', String(planned.sheet))
        .replace('{{total}}', String(plan.sheets));
      drawHeader(page, header.font, planned.header, headerName, encodable(label, header.font));
    }

    if (planned.cutLines) {
      const thickness = planned.cutLines.lineWidth;
      for (const s of planned.cutLines.segments) {
        page.drawLine({
          start: { x: s.x1, y: s.y1 },
          end: { x: s.x2, y: s.y2 },
          thickness,
          color: lineColor,
        });
      }
    }
  }

  return doc.save();
}
