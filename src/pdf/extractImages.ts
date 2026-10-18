import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFObjectCopier,
  PDFRawStream,
  PDFRef,
  concatTransformationMatrix,
  decodePDFRawStream,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  type PDFObject,
} from 'pdf-lib';

export interface FoundImage {
  /** Orden de la primera aparición en el documento. */
  order: number;
  /** Veces que se pinta en el PDF (sumando todas sus copias idénticas). */
  count: number;
  width: number;
  height: number;
  /** 'jpeg': se copia tal cual; 'render': se decodifica con pdf.js (página `renderPage`). */
  kind: 'jpeg' | 'render';
  bytes?: Uint8Array;
  renderPage?: number;
}

export interface Analysis {
  images: FoundImage[];
  /** PDF temporal con una página por imagen 'render', del tamaño exacto de la imagen. */
  renderPdf: Uint8Array | null;
  /** Imágenes distintas descartadas por pequeñas. */
  skipped: number;
}

export interface AnalyzeOptions {
  /** Se ignoran las imágenes cuyo lado mayor mide menos (px). */
  minSize?: number;
  onProgress?: (done: number, total: number) => void;
}

const MAX_DEPTH = 8;
const DO_OPERATOR = /\/([^\s/[\]<>(){}%]+)\s+Do\b/g;

interface Entry {
  ref: PDFRef;
  stream: PDFRawStream;
  count: number;
  order: number;
}

const name = (v: PDFObject | undefined) => (v instanceof PDFName ? v.decodeText() : undefined);
const num = (v: PDFObject | undefined) => (v instanceof PDFNumber ? v.asNumber() : 0);

/** Bytes descomprimidos del contenido de una página o formulario. */
function contentText(doc: PDFDocument, contents: PDFObject | undefined): string {
  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((r) => doc.context.lookup(r))
      : [contents instanceof PDFRef ? doc.context.lookup(contents) : contents];
  let text = '';
  for (const s of streams) {
    if (!(s instanceof PDFRawStream)) continue;
    try {
      const bytes = decodePDFRawStream(s).decode();
      for (let i = 0; i < bytes.length; i += 0x8000) {
        text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      text += '\n';
    } catch {
      // Filtro que pdf-lib no sabe descomprimir: no se pueden contar sus imágenes.
    }
  }
  return text;
}

/** Cuántas veces se pinta cada XObject («/Nombre Do») en un contenido. */
function paintsByName(text: string) {
  const counts = new Map<string, number>();
  for (const m of text.matchAll(DO_OPERATOR)) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  return counts;
}

/** El JPEG se puede copiar tal cual: RGB o gris, 8 bits, sin /Decode ni máscaras. */
function isPlainJpeg(doc: PDFDocument, dict: PDFDict, bytes: Uint8Array) {
  const filter = dict.lookup(PDFName.of('Filter'));
  const filters =
    filter instanceof PDFArray ? filter.asArray().map((f) => name(f)) : [name(filter)];
  if (filters.length !== 1 || filters[0] !== 'DCTDecode') return false;
  if (
    dict.has(PDFName.of('Decode')) ||
    dict.has(PDFName.of('SMask')) ||
    dict.has(PDFName.of('Mask'))
  ) {
    return false;
  }
  const bpc = dict.lookup(PDFName.of('BitsPerComponent'));
  if (bpc && num(bpc) !== 8) return false;

  const cs = dict.lookup(PDFName.of('ColorSpace'));
  let components = 0;
  if (name(cs) === 'DeviceRGB') components = 3;
  else if (name(cs) === 'DeviceGray') components = 1;
  else if (cs instanceof PDFArray && name(cs.get(0)) === 'ICCBased') {
    const icc = doc.context.lookup(cs.get(1));
    components = icc instanceof PDFRawStream ? num(icc.dict.lookup(PDFName.of('N'))) : 0;
  }
  if (components !== 3 && components !== 1) return false;
  // Y el propio JPEG no debe ser CMYK (4 componentes en su cabecera SOF).
  return jpegComponents(bytes) === components;
}

function jpegComponents(bytes: Uint8Array): number {
  let i = 2;
  while (i + 9 < bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return bytes[i + 9];
    }
    i += 2 + length;
  }
  return 0;
}

async function digest(bytes: Uint8Array, extra: string) {
  const data = new Uint8Array(bytes.length + extra.length);
  data.set(bytes);
  data.set(new TextEncoder().encode(extra), bytes.length);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Busca las imágenes que se pintan en el PDF, cuántas veces y en qué orden. Las imágenes
 * idénticas se juntan. Los JPEG normales se devuelven tal cual; el resto se copia a un PDF
 * temporal (una página por imagen) para que pdf.js las decodifique con sus colores correctos.
 */
export async function analyzeImages(
  data: Uint8Array | ArrayBuffer,
  { minSize = 100, onProgress }: AnalyzeOptions = {},
): Promise<Analysis> {
  const doc = await PDFDocument.load(data, { updateMetadata: false });
  const entries = new Map<string, Entry>();
  let order = 0;

  const visit = (resources: PDFDict | undefined, text: string, times: number, depth: number) => {
    const xobjects = resources?.lookup(PDFName.of('XObject'));
    if (!(xobjects instanceof PDFDict) || depth > MAX_DEPTH) return;
    for (const [xname, n] of paintsByName(text)) {
      const ref = xobjects.get(PDFName.of(xname));
      const stream = ref instanceof PDFRef ? doc.context.lookup(ref) : undefined;
      if (!(ref instanceof PDFRef) || !(stream instanceof PDFRawStream)) continue;
      const subtype = name(stream.dict.lookup(PDFName.of('Subtype')));
      if (subtype === 'Image') {
        const key = ref.toString();
        const entry = entries.get(key) ?? { ref, stream, count: 0, order: order++ };
        entry.count += n * times;
        entries.set(key, entry);
      } else if (subtype === 'Form') {
        const formResources = stream.dict.lookup(PDFName.of('Resources'));
        visit(
          formResources instanceof PDFDict ? formResources : resources,
          contentText(doc, stream),
          n * times,
          depth + 1,
        );
      }
    }
  };

  const pages = doc.getPages();
  for (const [i, page] of pages.entries()) {
    visit(page.node.Resources(), contentText(doc, page.node.Contents()), 1, 0);
    onProgress?.(i + 1, pages.length);
  }

  // Imágenes idénticas incrustadas por separado se cuentan como una.
  const unique = new Map<string, Entry>();
  for (const entry of [...entries.values()].sort((a, b) => a.order - b.order)) {
    const d = entry.stream.dict;
    const key = await digest(
      entry.stream.getContents(),
      `${num(d.lookup(PDFName.of('Width')))}x${num(d.lookup(PDFName.of('Height')))}`,
    );
    const seen = unique.get(key);
    if (seen) seen.count += entry.count;
    else unique.set(key, { ...entry });
  }

  const out = await PDFDocument.create();
  const copier = PDFObjectCopier.for(doc.context, out.context);
  const images: FoundImage[] = [];
  let skipped = 0;
  for (const entry of unique.values()) {
    const width = num(entry.stream.dict.lookup(PDFName.of('Width')));
    const height = num(entry.stream.dict.lookup(PDFName.of('Height')));
    if (Math.max(width, height) < minSize) {
      skipped++;
      continue;
    }
    const bytes = entry.stream.getContents();
    const base = { order: images.length, count: entry.count, width, height };
    if (isPlainJpeg(doc, entry.stream.dict, bytes)) {
      // Copia propia: getContents() puede ser una vista sobre todo el PDF.
      images.push({ ...base, kind: 'jpeg', bytes: bytes.slice() });
      continue;
    }
    // Una página del tamaño de la imagen, que se pinta entera: a escala 1, 1 pt = 1 px.
    const copied = copier.copy(entry.ref);
    const page = out.addPage([width, height]);
    page.node.setXObject(PDFName.of('Im0'), copied);
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(width, 0, 0, height, 0, 0),
      drawObject('Im0'),
      popGraphicsState(),
    );
    images.push({ ...base, kind: 'render', renderPage: out.getPageCount() - 1 });
  }

  return {
    images,
    renderPdf: out.getPageCount() > 0 ? await out.save() : null,
    skipped,
  };
}
