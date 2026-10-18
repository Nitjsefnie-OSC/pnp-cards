import { cropRect, imageDrawRect } from './crop';
import { DEFAULT_SETTINGS, type CropSettings } from './settings';

const image = { widthPx: 822, heightPx: 1122 };

function crop(over: Partial<CropSettings>): CropSettings {
  return { ...DEFAULT_SETTINGS.crop, enabled: true, widthMm: 63, heightMm: 88, ...over };
}

describe('cropRect', () => {
  it('convierte el tamaño en mm a píxeles a 300 ppp y lo centra en la imagen', () => {
    expect(cropRect(image, crop({ centered: true }))).toEqual({
      x: 39,
      y: 42,
      width: 744,
      height: 1039,
      clamped: false,
    });
  });

  it('usa la posición X/Y indicada si no está centrado', () => {
    expect(cropRect(image, crop({ centered: false, x: 10, y: 20 }))).toMatchObject({
      x: 10,
      y: 20,
      clamped: false,
    });
  });

  it('un tamaño de 0 mm deja esa dimensión entera', () => {
    expect(cropRect(image, crop({ widthMm: 0, centered: true }))).toMatchObject({
      x: 0,
      width: 822,
      height: 1039,
    });
  });

  it('ajusta al borde un recorte mayor que la imagen y lo indica', () => {
    expect(cropRect(image, crop({ widthMm: 100, heightMm: 50 }))).toEqual({
      x: 0,
      y: 266,
      width: 822,
      height: 591,
      clamped: true,
    });
  });

  it('mete dentro de la imagen un recorte que se sale por la posición', () => {
    expect(cropRect(image, crop({ centered: false, x: 200, y: 500 }))).toEqual({
      x: 78,
      y: 83,
      width: 744,
      height: 1039,
      clamped: true,
    });
  });
});

describe('imageDrawRect', () => {
  it('coloca la imagen completa para que el recorte ocupe exactamente el hueco de la carta', () => {
    const placement = { x: 100, y: 200, width: 178.56, height: 249.36 };
    const rect = imageDrawRect(placement, { x: 39, y: 42, width: 744, height: 1039 }, image);
    expect(rect.x).toBeCloseTo(90.64, 6);
    // y del PDF crece hacia arriba: debajo del recorte quedan 1122 − 42 − 1039 = 41 px.
    expect(rect.y).toBeCloseTo(190.16, 6);
    expect(rect.width).toBeCloseTo(197.28, 6);
    expect(rect.height).toBeCloseTo(269.28, 6);
  });
});
