import type { BuildInput } from '../pdf/buildPdf';
import type { Analysis } from '../pdf/extractImages';
import type { ExtractInput } from './extract.worker';
import type { MergeInput } from './merge.worker';
import type { SplitInput } from './split.worker';
import { runWorker, type TaskOptions } from './runWorker';

export { TaskError } from './runWorker';
export type { TaskOptions } from './runWorker';

export type GeneratePdf = (input: BuildInput, options?: TaskOptions) => Promise<Uint8Array>;
export type MergePdfs = (input: MergeInput, options?: TaskOptions) => Promise<Uint8Array>;
export type SplitImages = (input: SplitInput, options?: TaskOptions) => Promise<Uint8Array>;
export type AnalyzePdfImages = (input: ExtractInput, options?: TaskOptions) => Promise<Analysis>;
export type ConvertHeic = (data: ArrayBuffer, options?: TaskOptions) => Promise<Blob>;

/** Genera el PDF de cartas en un Web Worker (con progreso y cancelación). */
export const generatePdf: GeneratePdf = (input, options) =>
  runWorker(
    () => new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' }),
    input,
    options,
  );

/** Une varios PDF en un Web Worker (con progreso y cancelación). */
export const mergePdfs: MergePdfs = (input, options) =>
  runWorker(
    () => new Worker(new URL('./merge.worker.ts', import.meta.url), { type: 'module' }),
    input,
    options,
  );

/** Divide imágenes en partes y las devuelve en un ZIP, en un Web Worker. */
export const splitImages: SplitImages = (input, options) =>
  runWorker(
    () => new Worker(new URL('./split.worker.ts', import.meta.url), { type: 'module' }),
    input,
    options,
  );

/** Busca las imágenes incrustadas de un PDF en un Web Worker. */
export const analyzePdfImages: AnalyzePdfImages = (input, options) =>
  runWorker<Analysis>(
    () => new Worker(new URL('./extract.worker.ts', import.meta.url), { type: 'module' }),
    input,
    options,
  );

/**
 * Convierte una foto HEIC/HEIF a JPG en un Web Worker. libheif pesa: el worker no se precarga
 * (ver `globIgnores` en vite.config.ts), así que la primera vez necesita conexión.
 */
export const convertHeic: ConvertHeic = (data, options) =>
  runWorker<Blob>(
    () => new Worker(new URL('./heic.worker.ts', import.meta.url), { type: 'module' }),
    data,
    options,
  );
