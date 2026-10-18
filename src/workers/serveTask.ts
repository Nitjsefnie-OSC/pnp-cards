/// <reference lib="webworker" />
import type { WorkerMessage } from './runWorker';

declare const self: DedicatedWorkerGlobalScope;

type Task<T> = (input: T, onProgress: (done: number, total: number) => void) => Promise<Uint8Array>;

/** Código y dato del error para el hilo principal (por defecto, 'unknown'). */
export type ErrorInfo = (err: unknown) => { code: string; detail?: string };

/** Atiende en el worker una tarea que devuelve bytes, enviando progreso, resultado o error. */
export function serveTask<T>(task: Task<T>, errorInfo: ErrorInfo = () => ({ code: 'unknown' })) {
  const post = (msg: WorkerMessage, transfer: Transferable[] = []) =>
    self.postMessage(msg, transfer);
  self.onmessage = async (e: MessageEvent<T>) => {
    try {
      const result = await task(e.data, (done, total) => post({ type: 'progress', done, total }));
      post({ type: 'done', result }, [result.buffer]);
    } catch (err) {
      post({
        type: 'error',
        ...errorInfo(err),
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };
}
