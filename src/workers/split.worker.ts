import JSZip from 'jszip';
import type { PxRect } from '../lib/crop';
import { setPngDpi } from '../lib/png';
import { splitGrid } from '../lib/split';
import { serveTask } from './serveTask';

export interface SplitJob {
  /** Nombre del archivo original, para nombrar las partes. */
  name: string;
  blob: Blob;
  region: PxRect;
  columns: number;
  rows: number;
  /** Ppp con los que se guardan las partes. */
  dpi: number;
}

export type SplitInput = SplitJob[];

const baseName = (name: string) => name.replace(/\.[^.]+$/, '');

/** Nombres únicos aunque haya dos imágenes que se llamen igual. */
function uniqueBase(name: string, used: Set<string>) {
  const base = baseName(name);
  let candidate = base;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base} (${n})`;
  used.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Divide cada imagen en partes PNG (sin pérdida, con sus ppp) y las devuelve en un ZIP. Las partes
 * se llaman como en PDFCartas: «nombre_img_1.png», «nombre_img_2.png»…
 */
export async function splitToZip(
  jobs: SplitInput,
  onProgress: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const zip = new JSZip();
  const used = new Set<string>();
  const total = jobs.reduce((n, j) => n + j.columns * j.rows, 0);
  let done = 0;

  for (const job of jobs) {
    const base = uniqueBase(job.name, used);
    const bitmap = await createImageBitmap(job.blob);
    try {
      const parts = splitGrid(job.region, job.columns, job.rows);
      for (const [i, part] of parts.entries()) {
        const canvas = new OffscreenCanvas(part.width, part.height);
        canvas
          .getContext('2d')!
          .drawImage(
            bitmap,
            part.x,
            part.y,
            part.width,
            part.height,
            0,
            0,
            part.width,
            part.height,
          );
        const png = new Uint8Array(
          await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer(),
        );
        // PNG ya está comprimido: se guarda sin volver a comprimir.
        zip.file(`${base}_img_${i + 1}.png`, setPngDpi(png, job.dpi), { compression: 'STORE' });
        onProgress(++done, total);
      }
    } finally {
      bitmap.close();
    }
  }

  return zip.generateAsync({ type: 'uint8array' });
}

serveTask<SplitInput>(splitToZip);
