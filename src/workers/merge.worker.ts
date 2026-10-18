import { MergeError, mergePdfs, type PdfSource } from '../pdf/mergePdfs';
import { serveTask } from './serveTask';

export type MergeInput = PdfSource[];

serveTask<MergeInput>(mergePdfs, (err) =>
  err instanceof MergeError ? { code: 'unreadable', detail: err.fileName } : { code: 'unknown' },
);
