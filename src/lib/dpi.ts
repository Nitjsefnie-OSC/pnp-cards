export interface Dpi {
  x: number;
  y: number;
}

/**
 * Resolución en ppp guardada en los metadatos de un JPEG (JFIF o EXIF), PNG (pHYs) o TIFF.
 * null si la imagen no la indica; en ese caso PDFCartas la trataba como 72 ppp.
 */
export function readDpi(bytes: Uint8Array): Dpi | null {
  if (bytes.length < 8) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return readJpeg(bytes);
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return readPng(bytes);
  }
  if (isTiffHeader(bytes, 0)) return readTiff(bytes, 0);
  return null;
}

function view(bytes: Uint8Array) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function dpi(x: number, y: number): Dpi | null {
  if (!(x > 0) || !(y > 0)) return null;
  return { x: Math.round(x), y: Math.round(y) };
}

function readJpeg(bytes: Uint8Array): Dpi | null {
  const dv = view(bytes);
  let jfif: Dpi | null = null;
  let exif: Dpi | null = null;
  let pos = 2;
  while (pos + 4 <= bytes.length && bytes[pos] === 0xff) {
    const marker = bytes[pos + 1];
    // SOS: empiezan los datos de imagen, ya no hay más metadatos.
    if (marker === 0xda || marker === 0xd9) break;
    const length = dv.getUint16(pos + 2);
    const body = pos + 4;
    if (marker === 0xe0 && ascii(bytes, body, 5) === 'JFIF\0') {
      const units = bytes[body + 7];
      const x = dv.getUint16(body + 8);
      const y = dv.getUint16(body + 10);
      if (units === 1) jfif = dpi(x, y);
      else if (units === 2) jfif = dpi(x * 2.54, y * 2.54);
    } else if (marker === 0xe1 && ascii(bytes, body, 6) === 'Exif\0\0') {
      exif = readTiff(bytes, body + 6);
    }
    pos += 2 + length;
  }
  return jfif ?? exif;
}

function readPng(bytes: Uint8Array): Dpi | null {
  const dv = view(bytes);
  let pos = 8;
  while (pos + 8 <= bytes.length) {
    const length = dv.getUint32(pos);
    const type = ascii(bytes, pos + 4, 4);
    if (type === 'pHYs' && length >= 9) {
      // Unidad 1 = metro; 0 = solo relación de aspecto.
      if (bytes[pos + 16] !== 1) return null;
      return dpi(dv.getUint32(pos + 8) * 0.0254, dv.getUint32(pos + 12) * 0.0254);
    }
    if (type === 'IDAT' || type === 'IEND') return null;
    pos += 12 + length;
  }
  return null;
}

function isTiffHeader(bytes: Uint8Array, start: number) {
  const order = ascii(bytes, start, 2);
  return order === 'II' || order === 'MM';
}

/** Lee XResolution/YResolution/ResolutionUnit del primer IFD de una estructura TIFF. */
function readTiff(bytes: Uint8Array, start: number): Dpi | null {
  if (start + 8 > bytes.length || !isTiffHeader(bytes, start)) return null;
  const dv = view(bytes);
  const le = ascii(bytes, start, 2) === 'II';
  const u16 = (p: number) => dv.getUint16(start + p, le);
  const u32 = (p: number) => dv.getUint32(start + p, le);
  const rational = (p: number) => {
    const den = u32(p + 4);
    return den === 0 ? 0 : u32(p) / den;
  };

  try {
    const ifd = u32(4);
    const count = u16(ifd);
    let x = 0;
    let y = 0;
    let unit = 2;
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12;
      const tag = u16(entry);
      if (tag === 0x011a) x = rational(u32(entry + 8));
      else if (tag === 0x011b) y = rational(u32(entry + 8));
      else if (tag === 0x0128) unit = u16(entry + 8);
    }
    // 2 = pulgadas, 3 = centímetros, 1 = sin unidad.
    if (unit === 3) return dpi(x * 2.54, y * 2.54);
    if (unit === 2) return dpi(x, y);
    return null;
  } catch {
    return null;
  }
}
