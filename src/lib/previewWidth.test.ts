import { clampPreviewWidth, previewWidthLimits } from './previewWidth';

describe('previewWidthLimits', () => {
  it('deja sitio a los ajustes (300 px) y al menos una columna de cartas', () => {
    // 1600 − 300 de ajustes − 220 de cartas = 1080.
    expect(previewWidthLimits(1600)).toEqual({ min: 280, max: 1080 });
  });

  it('en ventanas justas, el máximo no baja del mínimo', () => {
    expect(previewWidthLimits(1100)).toEqual({ min: 280, max: 580 });
    expect(previewWidthLimits(700)).toEqual({ min: 280, max: 280 });
  });
});

describe('clampPreviewWidth', () => {
  it('deja el ancho entre el mínimo y el máximo, en píxeles enteros', () => {
    expect(clampPreviewWidth(500.6, 1600)).toBe(501);
    expect(clampPreviewWidth(100, 1600)).toBe(280);
    expect(clampPreviewWidth(2000, 1600)).toBe(1080);
  });
});
