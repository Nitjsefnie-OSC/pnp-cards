import { decodeHeic, HEIC_JPEG_QUALITY } from './heicDecode';
import { serveTask } from './serveTask';

serveTask<ArrayBuffer, Blob>(
  async (buffer) => {
    const { width, height, data } = await decodeHeic(new Uint8Array(buffer));
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d')!.putImageData(new ImageData(data, width, height), 0, 0);
    return canvas.convertToBlob({ type: 'image/jpeg', quality: HEIC_JPEG_QUALITY });
  },
  () => ({ code: 'unreadable' }),
  () => [],
);
