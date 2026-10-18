import type { PlanErrorCode } from '../lib/plan';
import type { BuildInput } from '../pdf/buildPdf';

export type WorkerMessage =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; pdf: Uint8Array }
  | { type: 'error'; code: PlanErrorCode | 'unknown'; message: string };

export class PdfError extends Error {
  constructor(
    readonly code: PlanErrorCode | 'unknown',
    message: string,
  ) {
    super(message);
    this.name = 'PdfError';
  }
}

export interface GenerateOptions {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export type GeneratePdf = (input: BuildInput, options?: GenerateOptions) => Promise<Uint8Array>;

/**
 * Genera el PDF en un Web Worker. Al abortar la señal se termina el worker y la promesa se
 * rechaza con un AbortError.
 */
export const generatePdf: GeneratePdf = (input, { onProgress, signal } = {}) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelado', 'AbortError'));

    const worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => {
      worker.terminate();
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      finish();
      reject(new DOMException('Cancelado', 'AbortError'));
    };
    signal?.addEventListener('abort', abort);

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.type === 'progress') onProgress?.(msg.done, msg.total);
      else if (msg.type === 'done') {
        finish();
        resolve(msg.pdf);
      } else {
        finish();
        reject(new PdfError(msg.code, msg.message));
      }
    };
    worker.onerror = (e) => {
      finish();
      reject(new PdfError('unknown', e.message));
    };
    worker.postMessage(input);
  });
