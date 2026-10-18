import type { PxRect } from './crop';

/**
 * Divide una zona en filas × columnas, de izquierda a derecha y de arriba abajo. Si no sale
 * exacto, el sobrante se reparte: unas partes miden 1 px más que otras.
 */
export function splitGrid(region: PxRect, columns: number, rows: number): PxRect[] {
  const xs = Array.from({ length: columns + 1 }, (_, i) =>
    Math.floor((i * region.width) / columns),
  );
  const ys = Array.from({ length: rows + 1 }, (_, i) => Math.floor((i * region.height) / rows));
  const parts: PxRect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      parts.push({
        x: region.x + xs[c],
        y: region.y + ys[r],
        width: xs[c + 1] - xs[c],
        height: ys[r + 1] - ys[r],
      });
    }
  }
  return parts;
}

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, como ImageData. */
  data: Uint8ClampedArray;
}

/**
 * Zona con contenido dentro de un margen de color uniforme (el de la esquina superior izquierda),
 * con tolerancia para el ruido de compresión. Sin margen, la imagen entera.
 */
export function detectBorder({ width, height, data }: Pixels, tolerance = 24): PxRect {
  const [r0, g0, b0] = data;
  const differs = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return (
      Math.abs(data[i] - r0) > tolerance ||
      Math.abs(data[i + 1] - g0) > tolerance ||
      Math.abs(data[i + 2] - b0) > tolerance
    );
  };
  const rowHas = (y: number) => {
    for (let x = 0; x < width; x++) if (differs(x, y)) return true;
    return false;
  };
  const columnHas = (x: number, top: number, bottom: number) => {
    for (let y = top; y <= bottom; y++) if (differs(x, y)) return true;
    return false;
  };

  let top = 0;
  while (top < height && !rowHas(top)) top++;
  if (top === height) return { x: 0, y: 0, width, height };
  let bottom = height - 1;
  while (bottom > top && !rowHas(bottom)) bottom--;
  let left = 0;
  while (left < width - 1 && !columnHas(left, top, bottom)) left++;
  let right = width - 1;
  while (right > left && !columnHas(right, top, bottom)) right--;

  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
