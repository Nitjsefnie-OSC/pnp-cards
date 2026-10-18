/** Mensajes de un worker de tarea larga: progreso, resultado o error. */
export type WorkerMessage<T = unknown> =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; result: T }
  | { type: 'error'; code: string; message: string; detail?: string };

/** Error de una tarea en un worker, con un código para mostrar un mensaje útil. */
export class TaskError extends Error {
  constructor(
    readonly code: string,
    message: string,
    /** Dato para el mensaje, p. ej. el archivo que ha fallado. */
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'TaskError';
  }
}

export interface TaskOptions {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Ejecuta una tarea en un Web Worker creado para ella. Al abortar la señal se termina el worker
 * y la promesa se rechaza con un AbortError.
 */
export function runWorker<T = Uint8Array>(
  createWorker: () => Worker,
  input: unknown,
  { onProgress, signal }: TaskOptions = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelado', 'AbortError'));

    const worker = createWorker();
    const finish = () => {
      worker.terminate();
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      finish();
      reject(new DOMException('Cancelado', 'AbortError'));
    };
    signal?.addEventListener('abort', abort);

    worker.onmessage = (e: MessageEvent<WorkerMessage<T>>) => {
      const msg = e.data;
      if (msg.type === 'progress') onProgress?.(msg.done, msg.total);
      else if (msg.type === 'done') {
        finish();
        resolve(msg.result);
      } else {
        finish();
        reject(new TaskError(msg.code, msg.message, msg.detail));
      }
    };
    worker.onerror = (e) => {
      finish();
      reject(new TaskError('unknown', e.message));
    };
    worker.postMessage(input);
  });
}
