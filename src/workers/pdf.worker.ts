/// <reference lib="webworker" />
import { PlanError } from '../lib/plan';
import { buildPdf, type BuildInput } from '../pdf/buildPdf';
import type { WorkerMessage } from './pdfClient';

declare const self: DedicatedWorkerGlobalScope;

const post = (msg: WorkerMessage, transfer: Transferable[] = []) => self.postMessage(msg, transfer);

self.onmessage = async (e: MessageEvent<BuildInput>) => {
  try {
    const pdf = await buildPdf(e.data, (done, total) => post({ type: 'progress', done, total }));
    post({ type: 'done', pdf }, [pdf.buffer]);
  } catch (err) {
    post({
      type: 'error',
      code: err instanceof PlanError ? err.code : 'unknown',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
