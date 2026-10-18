export type LayoutMode = 'vertical9' | 'horizontal8' | 'manual';
export type PaperSize = 'A4' | 'A3' | 'custom';
export type Placement = 'separated' | 'together';
export type CutLineStyle = 'normal' | 'full' | 'cross';

export interface CropSettings {
  enabled: boolean;
  /** Tamaño del recorte en mm; se convierte a píxeles a 300 ppp. */
  widthMm: number;
  heightMm: number;
  centered: boolean;
  /** Posición en píxeles cuando no está centrado. */
  x: number;
  y: number;
}

export interface LayoutSettings {
  mode: LayoutMode;
  /** Solo en modo manual. */
  paper: PaperSize;
  landscape: boolean;
  columns: number;
  rows: number;
  customPageMm: { width: number; height: number };

  placement: Placement;
  /** Margen de la página en mm (solo con cartas separadas). */
  marginMm: number;
  rightToLeft: boolean;
  duplex: boolean;

  forceWidth: boolean;
  forceHeight: boolean;
  cardWidthMm: number;
  cardHeightMm: number;

  crop: CropSettings;

  cutLines: {
    enabled: boolean;
    style: CutLineStyle;
    color: string;
    /** Grosor en centésimas de mm. */
    widthHundredthsMm: number;
  };
  bleed: { enabled: boolean; mm: number; color: string };
}

/** Valores por defecto de PDFCartas (My Project/Settings.settings). */
export const DEFAULT_SETTINGS: LayoutSettings = {
  mode: 'vertical9',
  paper: 'A4',
  landscape: false,
  columns: 3,
  rows: 3,
  customPageMm: { width: 210, height: 297 },
  placement: 'separated',
  marginMm: 8,
  rightToLeft: false,
  duplex: false,
  forceWidth: false,
  forceHeight: false,
  cardWidthMm: 0,
  cardHeightMm: 0,
  crop: { enabled: false, widthMm: 0, heightMm: 0, centered: true, x: 0, y: 0 },
  cutLines: { enabled: false, style: 'normal', color: '#000000', widthHundredthsMm: 4 },
  bleed: { enabled: false, mm: 2, color: '#ffffff' },
};

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

/** Completa una configuración guardada (quizá de una versión anterior) con los valores por defecto. */
export function mergeSettings(saved: DeepPartial<LayoutSettings> | undefined): LayoutSettings {
  const d = DEFAULT_SETTINGS;
  return {
    ...d,
    ...saved,
    customPageMm: { ...d.customPageMm, ...saved?.customPageMm },
    crop: { ...d.crop, ...saved?.crop },
    cutLines: { ...d.cutLines, ...saved?.cutLines },
    bleed: { ...d.bleed, ...saved?.bleed },
  };
}
