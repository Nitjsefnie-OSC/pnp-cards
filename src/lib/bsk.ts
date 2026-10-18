import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type CutLineStyle,
  type LayoutMode,
  type LayoutSettings,
  type PaperSize,
} from './settings';

/** Imagen de un proyecto .bsk: ruta relativa a la carpeta del proyecto (vacía = en blanco). */
export interface BskImage {
  path: string;
  name: string;
  /** null en el formato antiguo, que no guardaba copias (se leen del nombre). */
  copies: number | null;
}

export interface BskProject {
  settings: LayoutSettings;
  images: BskImage[];
}

const MODES: LayoutMode[] = ['vertical9', 'horizontal8', 'manual'];
const PAPERS: PaperSize[] = ['A4', 'A3', 'custom'];
const LINES: CutLineStyle[] = ['normal', 'full', 'cross'];

/** Marca de orden de bytes (U+FEFF) que añadía XmlTextWriter al principio del archivo. */
const BOM = String.fromCharCode(0xfeff);

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? '';

/** Color.ToArgb() de .NET (entero con signo) a "#rrggbb". */
function argbToHex(value: string | null, fallback: string) {
  const n = value ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return `#${((n >>> 0) & 0xffffff).toString(16).padStart(6, '0')}`;
}

function parseXml(doc: Document): BskProject {
  const text = (tag: string) => doc.getElementsByTagName(tag)[0]?.textContent?.trim() ?? null;
  // Los números pueden venir con coma decimal (configuración regional española).
  const num = (tag: string, fallback: number) => {
    const v = text(tag);
    const n = v === null || v === '' ? NaN : Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  };
  const flag = (tag: string, fallback: boolean) => {
    const v = text(tag);
    return v === null ? fallback : v === '1' || v.toLowerCase() === 'true';
  };

  const d = DEFAULT_SETTINGS;
  const version = num('version', 1);
  const mode = MODES[num('modo', 0)] ?? d.mode;
  const forzar = num('forzar', 0);
  const corte = num('corte', 0);

  const settings = mergeSettings({
    mode,
    paper: PAPERS[num('man_tamaño', 0)] ?? d.paper,
    landscape: flag('man_horizontal', d.landscape),
    columns: num('man_columnas', d.columns),
    rows: num('man_filas', d.rows),
    customPageMm: {
      width: version >= 4 ? num('man_pag_ancho', d.customPageMm.width) : d.customPageMm.width,
      height: version >= 4 ? num('man_pag_alto', d.customPageMm.height) : d.customPageMm.height,
    },
    placement: text('colocar') === '1' ? 'together' : 'separated',
    marginMm: num('sep_margen', d.marginMm),
    rightToLeft: flag('col_derecha', d.rightToLeft),
    duplex: version >= 3 ? flag('col_doblecara', d.duplex) : d.duplex,
    forceWidth: (forzar & 1) !== 0,
    forceHeight: (forzar & 2) !== 0,
    cardWidthMm: num('for_ancho', d.cardWidthMm),
    cardHeightMm: num('for_alto', d.cardHeightMm),
    crop: {
      enabled: flag('recortar', false),
      widthMm: num('rec_ancho', d.crop.widthMm),
      heightMm: num('rec_alto', d.crop.heightMm),
      // Guardar() escribía rec_centrado pero Abrir() leía rec_centro: se aceptan las dos.
      centered: flag('rec_centrado', flag('rec_centro', d.crop.centered)),
      x: num('rec_x', d.crop.x),
      y: num('rec_y', d.crop.y),
    },
    cutLines: {
      enabled: (corte & 1) !== 0,
      style: LINES[num('cor_lineas', 0)] ?? d.cutLines.style,
      color: argbToHex(text('cor_lin_color'), d.cutLines.color),
      widthHundredthsMm:
        version >= 2
          ? num('cor_lin_ancho', d.cutLines.widthHundredthsMm)
          : d.cutLines.widthHundredthsMm,
    },
    bleed: {
      enabled: (corte & 2) !== 0,
      mm: num('cor_margen', d.bleed.mm),
      color: argbToHex(text('cor_mar_color'), d.bleed.color),
    },
  });

  const images = [...doc.getElementsByTagName('imagen')].map((node) => {
    const path = node.getElementsByTagName('url')[0]?.textContent?.trim() ?? '';
    const raw = node.getElementsByTagName('copias')[0]?.textContent?.trim();
    const copies = raw ? Number(raw) : NaN;
    return {
      path,
      name: baseName(path),
      // Sin copias válidas, se leerán del nombre del archivo (" xN") al importar.
      copies: Number.isInteger(copies) && copies > 0 ? copies : null,
    };
  });

  return { settings, images };
}

/**
 * Lee un proyecto de PDFCartas (.bsk): XML (versiones 1 a 4) o el formato antiguo, una ruta de
 * imagen por línea.
 */
export function parseBsk(content: string): BskProject {
  const trimmed = (content.startsWith(BOM) ? content.slice(1) : content).trimStart();
  if (trimmed.startsWith('<')) {
    const doc = new DOMParser().parseFromString(trimmed, 'application/xml');
    if (!doc.getElementsByTagName('parsererror').length) return parseXml(doc);
  }
  const images = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((path) => ({ path, name: baseName(path), copies: null }));
  return { settings: DEFAULT_SETTINGS, images };
}
