/** Puntos PDF por milímetro (72 pt por pulgada). */
export const PT_PER_MM = 72 / 25.4;

export const mmToPt = (mm: number) => mm * PT_PER_MM;
export const ptToMm = (pt: number) => pt / PT_PER_MM;

/** Milímetros a píxeles a la resolución dada (300 ppp por defecto, como el recorte del original). */
export const mmToPx = (mm: number, dpi = 300) => Math.round((mm * dpi) / 25.4);
export const pxToMm = (px: number, dpi = 300) => (px * 25.4) / dpi;
