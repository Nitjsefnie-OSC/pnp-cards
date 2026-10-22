/**
 * Páginas elegidas con un texto como «1-3, 5» (también «8-» o «-2»), ordenadas y sin repetir.
 * Vacío = todas. null si el texto no es válido o se sale del documento.
 */
export function parsePageRange(text: string, pageCount: number): number[] | null {
  const parts = text
    .split(/[,;]/)
    .map((p) => p.replace(/\s+/g, ''))
    .filter(Boolean);
  if (parts.length === 0) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const pages = new Set<number>();
  for (const part of parts) {
    const match = /^(\d*)(-?)(\d*)$/.exec(part);
    if (!match || (!match[1] && !match[3])) return null;
    const [, a, dash, b] = match;
    const from = a ? Number(a) : 1;
    const to = dash ? (b ? Number(b) : pageCount) : from;
    if (from < 1 || to > pageCount || from > to) return null;
    for (let p = from; p <= to; p++) pages.add(p);
  }
  return [...pages].sort((x, y) => x - y);
}

/**
 * Texto de rango para unas páginas, al revés que `parsePageRange`: «1-3, 5». Todas las páginas
 * del documento dan el texto vacío.
 */
export function formatPageRange(pages: number[], pageCount: number): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  if (sorted.length === pageCount && sorted.every((p, i) => p === i + 1)) return '';
  const parts: string[] = [];
  let start = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) continue;
    const end = sorted[i - 1];
    parts.push(start === end ? `${start}` : `${start}-${end}`);
    start = sorted[i];
  }
  return parts.join(', ');
}

/** Tamaño en píxeles de una página (en puntos PDF) a los ppp dados. */
export function pagePixels(size: { width: number; height: number }, dpi: number) {
  return {
    width: Math.round((size.width * dpi) / 72),
    height: Math.round((size.height * dpi) / 72),
  };
}
