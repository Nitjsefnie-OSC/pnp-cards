import { useEffect, useState } from 'react';
import { clampPreviewWidth } from '../../lib/previewWidth';
import { useSettingsStore } from '../../store/settingsStore';

/** Ancho de la ventana, actualizado al cambiar su tamaño. */
export function useViewportWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return width;
}

/** Ancho de la vista previa dentro de los límites de la ventana actual. */
export function usePreviewWidth() {
  const stored = useSettingsStore((s) => s.previewWidth);
  return clampPreviewWidth(stored, useViewportWidth());
}
