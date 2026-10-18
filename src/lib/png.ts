const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const SIGNATURE_LENGTH = 8;

/**
 * Devuelve el PNG con su resolución en ppp (chunk pHYs justo después de IHDR, sustituyendo el
 * que hubiera). Los PNG que genera canvas no la traen, y Cartas la usa para el tamaño.
 */
export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Uint8Array[] = [];
  let pos = SIGNATURE_LENGTH;
  while (pos + 8 <= png.length) {
    const length = view.getUint32(pos);
    const type = String.fromCharCode(...png.subarray(pos + 4, pos + 8));
    const end = pos + 12 + length;
    if (type !== 'pHYs') chunks.push(png.subarray(pos, end));
    pos = end;
  }

  const ppm = Math.round(dpi / 0.0254);
  const phys = new Uint8Array(21);
  const pv = new DataView(phys.buffer);
  pv.setUint32(0, 9);
  phys.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  pv.setUint32(8, ppm);
  pv.setUint32(12, ppm);
  phys[16] = 1; // unidad: metro
  pv.setUint32(17, crc32(phys.subarray(4, 17)));

  // IHDR siempre es el primer chunk.
  const [ihdr, ...rest] = chunks;
  const parts = [png.subarray(0, SIGNATURE_LENGTH), ihdr, phys, ...rest];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
