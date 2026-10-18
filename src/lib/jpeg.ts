/**
 * Devuelve el JPEG con su resolución en ppp en la cabecera JFIF (la que trae canvas no indica
 * unidades). Si no hay cabecera JFIF, se añade una al principio. No toca los datos de imagen.
 */
export function setJpegDpi(jpeg: Uint8Array, dpi: number): Uint8Array {
  const density = Math.max(1, Math.min(0xffff, Math.round(dpi)));
  const isJfif =
    jpeg[2] === 0xff &&
    jpeg[3] === 0xe0 &&
    String.fromCharCode(...jpeg.subarray(6, 11)) === 'JFIF\0';

  if (isJfif) {
    const out = jpeg.slice();
    const view = new DataView(out.buffer);
    // Tras «JFIF\0» y la versión (2 bytes): unidades (1 = ppp) y densidad X/Y.
    out[13] = 1;
    view.setUint16(14, density);
    view.setUint16(16, density);
    return out;
  }

  const app0 = new Uint8Array([
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x01,
    density >> 8,
    density & 0xff,
    density >> 8,
    density & 0xff,
    0x00,
    0x00,
  ]);
  const out = new Uint8Array(jpeg.length + app0.length);
  out.set(jpeg.subarray(0, 2));
  out.set(app0, 2);
  out.set(jpeg.subarray(2), 2 + app0.length);
  return out;
}
