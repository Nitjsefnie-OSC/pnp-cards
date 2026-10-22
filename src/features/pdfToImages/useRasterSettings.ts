import { useState } from 'react';
import { pagePixels, parsePageRange } from '../../lib/pageRange';
import type { PdfInfo } from '../../pdf/pdfjs';
import type { RasterFormat } from '../../pdf/rasterize';

/** Formato, resolución y rango de páginas para dibujar un PDF como imágenes. */
export function useRasterSettings(info: PdfInfo | null) {
  const [format, setFormat] = useState<RasterFormat>('jpeg');
  const [preset, setPreset] = useState<string>('300');
  const [customDpi, setCustomDpi] = useState(400);
  const [range, setRange] = useState('');
  const dpi = preset === 'custom' ? customDpi : Number(preset);
  return {
    format,
    setFormat,
    preset,
    setPreset,
    customDpi,
    setCustomDpi,
    range,
    setRange,
    dpi,
    /** Páginas elegidas (desde 1), o null si el rango no es válido. */
    pages: info ? parsePageRange(range, info.pages) : null,
    size: info?.firstPage ? pagePixels(info.firstPage, dpi) : null,
  };
}

export type RasterSettings = ReturnType<typeof useRasterSettings>;
