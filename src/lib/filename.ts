/**
 * Número de copias indicado en el nombre del archivo con el sufijo " xN" justo antes de la
 * extensión ("Héroe x3.png" → 3), como hacía PDFCartas. null si no hay sufijo válido.
 */
export function parseCopies(fileName: string): number | null {
  const dot = fileName.lastIndexOf('.');
  const mark = fileName.lastIndexOf(' x');
  if (dot === -1 || mark === -1 || mark > dot) return null;
  const digits = fileName.slice(mark + 2, dot);
  if (!/^\d+$/.test(digits)) return null;
  const copies = Number(digits);
  return copies > 0 ? copies : null;
}

/** Quita de un nombre los caracteres que no valen en un nombre de archivo. */
export const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_').trim();
