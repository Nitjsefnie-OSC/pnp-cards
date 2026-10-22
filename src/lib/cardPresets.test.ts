import { CARD_PRESETS, cardSizeChoice, presetSettings } from './cardPresets';
import { DEFAULT_SETTINGS, type LayoutSettings } from './settings';

function settings(over: Partial<LayoutSettings>): LayoutSettings {
  return { ...DEFAULT_SETTINGS, ...over };
}

describe('CARD_PRESETS', () => {
  it('lista los tamaños habituales en mm', () => {
    expect(CARD_PRESETS.map((p) => [p.id, p.widthMm, p.heightMm])).toEqual([
      ['poker', 63, 88],
      ['bridge', 57, 89],
      ['japanese', 59, 86],
      ['miniEuro', 44, 68],
      ['miniAmerican', 41, 63],
      ['euro', 59, 92],
      ['tarot', 70, 120],
      ['square', 70, 70],
    ]);
  });
});

describe('cardSizeChoice', () => {
  it('sin forzar nada, según la resolución de la imagen', () => {
    expect(cardSizeChoice(DEFAULT_SETTINGS)).toBe('image');
  });

  it('ambos forzados y coinciden con un tamaño: ese tamaño', () => {
    const s = settings({ forceWidth: true, forceHeight: true, cardWidthMm: 44, cardHeightMm: 68 });
    expect(cardSizeChoice(s)).toBe('miniEuro');
  });

  it('medidas que no coinciden: personalizado', () => {
    const s = settings({ forceWidth: true, forceHeight: true, cardWidthMm: 64, cardHeightMm: 88 });
    expect(cardSizeChoice(s)).toBe('custom');
  });

  it('con un solo lado forzado: personalizado, aunque las medidas coincidan', () => {
    expect(cardSizeChoice(settings({ forceWidth: true, cardWidthMm: 63, cardHeightMm: 88 }))).toBe(
      'custom',
    );
    expect(cardSizeChoice(settings({ forceHeight: true, cardWidthMm: 63, cardHeightMm: 88 }))).toBe(
      'custom',
    );
  });

  it('la carta girada (88 × 63) no es póker', () => {
    const s = settings({ forceWidth: true, forceHeight: true, cardWidthMm: 88, cardHeightMm: 63 });
    expect(cardSizeChoice(s)).toBe('custom');
  });
});

describe('presetSettings', () => {
  it('fuerza ancho y alto con las medidas del tamaño', () => {
    expect(presetSettings('tarot')).toEqual({
      forceWidth: true,
      forceHeight: true,
      cardWidthMm: 70,
      cardHeightMm: 120,
    });
  });
});
