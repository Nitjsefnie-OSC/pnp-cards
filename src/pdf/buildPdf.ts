import {
  PDFDocument,
  clip,
  concatTransformationMatrix,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import { imageDrawRect } from '../lib/crop';
import type { Dpi } from '../lib/dpi';
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
}

export interface BuildInput {
  settings: LayoutSettings;
  cards: PdfCard[];
  title?: string;
}

export type ProgressHandler = (done: number, total: number) => void;

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
  const { settings, cards } = input;
  const plan = planDocument(
    settings,
    cards.map((c) => ({ ...c, blank: c.data === null })),
  );

  const doc = await PDFDocument.create();
  doc.setCreator('PnP Cards');
  doc.setProducer('PnP Cards (pdf-lib)');
  if (input.title) doc.setTitle(input.title);

  const embedded = new Map<number, PDFImage>();
  async function image(index: number): Promise<PDFImage | null> {
    const card = cards[index];
    if (!card.data) return null;
    let img = embedded.get(index);
    if (!img) {
      const bytes = new Uint8Array(await card.data.arrayBuffer());
      img = card.format === 'jpeg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
      embedded.set(index, img);
    }
    return img;
  }

  const bleedColor = hexToRgb(settings.bleed.color);
  const lineColor = hexToRgb(settings.cutLines.color);
  let done = 0;

  for (const planned of plan.pages) {
    const page: PDFPage = doc.addPage([planned.size.width, planned.size.height]);

    // El margen de corte va debajo de las cartas.
    for (const r of planned.bleed) {
      page.drawRectangle({ ...r, color: bleedColor });
    }

    for (const { card, placement, crop, rotation } of planned.items) {
      const img = await image(card);
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
        page.drawImage(img, crop ? imageDrawRect(local, crop, cards[card]) : local);
        page.pushOperators(popGraphicsState());
      } else if (img && crop) {
        // Se dibuja la imagen entera y una máscara del tamaño del hueco oculta lo recortado.
        const { x, y, width, height } = placement;
        page.pushOperators(pushGraphicsState(), rectangle(x, y, width, height), clip(), endPath());
        page.drawImage(img, imageDrawRect(placement, crop, cards[card]));
        page.pushOperators(popGraphicsState());
      } else if (img) {
        page.drawImage(img, placement);
      }
      done += 1;
      onProgress?.(done, plan.total);
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
