/** Ancho de la columna de ajustes y mínimo para la lista de cartas (una columna), en px. */
const SETTINGS_COLUMN = 300;
const MIN_CARDS_COLUMN = 220;
export const MIN_PREVIEW_WIDTH = 280;
export const DEFAULT_PREVIEW_WIDTH = 380;

/** Límites del ancho de la vista previa para un ancho de ventana. */
export function previewWidthLimits(viewportWidth: number) {
  const max = Math.max(MIN_PREVIEW_WIDTH, viewportWidth - SETTINGS_COLUMN - MIN_CARDS_COLUMN);
  return { min: MIN_PREVIEW_WIDTH, max };
}

/** Ancho de la vista previa dentro de sus límites, en píxeles enteros. */
export function clampPreviewWidth(width: number, viewportWidth: number) {
  const { min, max } = previewWidthLimits(viewportWidth);
  return Math.min(max, Math.max(min, Math.round(width)));
}
