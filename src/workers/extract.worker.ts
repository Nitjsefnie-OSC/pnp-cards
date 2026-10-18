import { analyzeImages, type Analysis } from '../pdf/extractImages';
import { serveTask } from './serveTask';

export interface ExtractInput {
  data: ArrayBuffer;
  minSize: number;
}

serveTask<ExtractInput, Analysis>(
  ({ data, minSize }, onProgress) => analyzeImages(data, { minSize, onProgress }),
  (err) => ({
    code: err instanceof Error && /encrypt/i.test(err.message) ? 'encrypted' : 'unreadable',
  }),
  (out) => [
    ...new Set([
      ...out.images.flatMap((i) => (i.bytes ? [i.bytes.buffer as ArrayBuffer] : [])),
      ...(out.renderPdf ? [out.renderPdf.buffer as ArrayBuffer] : []),
    ]),
  ],
);
