import { useState } from 'react';
import { formatPageRange, pagePixels, parsePageRange } from '../../lib/pageRange';
import type { PdfInfo } from '../../pdf/pdfjs';
import type { RasterFormat } from '../../pdf/rasterize';

/** Formato, resolución y rango de páginas para dibujar un PDF como imágenes. */
export function useRasterSettings(info: PdfInfo | null) {
  const [format, setFormat] = useState<RasterFormat>('jpeg');
  const [preset, setPreset] = useState<string>('300');
  const [customDpi, setCustomDpi] = useState(400);
  const [range, setRangeText] = useState('');
  // El rango vacío significa «todas»; ninguna página se guarda aparte.
  const [none, setNone] = useState(false);
  const dpi = preset === 'custom' ? customDpi : Number(preset);
  const pageCount = info?.pages ?? 0;
  const pages = !info ? null : none ? [] : parsePageRange(range, pageCount);

  function setRange(text: string) {
    setRangeText(text);
    setNone(false);
  }

  function choose(chosen: number[]) {
    setRangeText(formatPageRange(chosen, pageCount));
    setNone(chosen.length === 0);
  }

  return {
    format,
    setFormat,
    preset,
    setPreset,
    customDpi,
    setCustomDpi,
    range,
    setRange,
    /** Marca o desmarca una página (desde 1); con un rango no válido, empieza desde cero. */
    togglePage: (page: number) =>
      choose(pages?.includes(page) ? pages.filter((p) => p !== page) : [...(pages ?? []), page]),
    selectAll: () => choose(Array.from({ length: pageCount }, (_, i) => i + 1)),
    selectNone: () => choose([]),
    dpi,
    /** Páginas elegidas (desde 1), o null si el rango no es válido. */
    pages,
    size: info?.firstPage ? pagePixels(info.firstPage, dpi) : null,
  };
}

export type RasterSettings = ReturnType<typeof useRasterSettings>;
