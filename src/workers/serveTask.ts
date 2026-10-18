/// <reference lib="webworker" />
import type { WorkerMessage } from './runWorker';

declare const self: DedicatedWorkerGlobalScope;

type Task<TIn, TOut> = (
  input: TIn,
  onProgress: (done: number, total: number) => void,
) => Promise<TOut>;

/** Código y dato del error para el hilo principal (por defecto, 'unknown'). */
export type ErrorInfo = (err: unknown) => { code: string; detail?: string };

/** Buffers del resultado que se transfieren (sin copiarlos) al hilo principal. */
const defaultTransfer = (out: unknown): Transferable[] =>
  out instanceof Uint8Array ? [out.buffer as ArrayBuffer] : [];

/** Atiende en el worker una tarea larga, enviando progreso, resultado o error. */
export function serveTask<TIn, TOut = Uint8Array>(
  task: Task<TIn, TOut>,
  errorInfo: ErrorInfo = () => ({ code: 'unknown' }),
  transfer: (out: TOut) => Transferable[] = defaultTransfer,
) {
  const post = (msg: WorkerMessage<TOut>, list: Transferable[] = []) => self.postMessage(msg, list);
  self.onmessage = async (e: MessageEvent<TIn>) => {
    try {
      const result = await task(e.data, (done, total) => post({ type: 'progress', done, total }));
      post({ type: 'done', result }, transfer(result));
    } catch (err) {
      post({
        type: 'error',
        ...errorInfo(err),
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };
}
