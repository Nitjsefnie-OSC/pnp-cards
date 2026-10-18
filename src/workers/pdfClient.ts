import type { BuildInput } from '../pdf/buildPdf';
import type { MergeInput } from './merge.worker';
import type { SplitInput } from './split.worker';
import { runWorker, type TaskOptions } from './runWorker';

export { TaskError } from './runWorker';
export type { TaskOptions } from './runWorker';

export type GeneratePdf = (input: BuildInput, options?: TaskOptions) => Promise<Uint8Array>;
export type MergePdfs = (input: MergeInput, options?: TaskOptions) => Promise<Uint8Array>;
export type SplitImages = (input: SplitInput, options?: TaskOptions) => Promise<Uint8Array>;

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
