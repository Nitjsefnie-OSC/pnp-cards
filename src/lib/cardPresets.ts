import type { LayoutSettings } from './settings';

/** Tamaños de carta habituales, en mm (ancho × alto, en vertical). */
export const CARD_PRESETS = [
  { id: 'poker', widthMm: 63, heightMm: 88 },
  { id: 'bridge', widthMm: 57, heightMm: 89 },
  { id: 'japanese', widthMm: 59, heightMm: 86 },
  { id: 'miniEuro', widthMm: 44, heightMm: 68 },
  { id: 'miniAmerican', widthMm: 41, heightMm: 63 },
  { id: 'euro', widthMm: 59, heightMm: 92 },
  { id: 'tarot', widthMm: 70, heightMm: 120 },
  { id: 'square', widthMm: 70, heightMm: 70 },
] as const;

export type CardPresetId = (typeof CARD_PRESETS)[number]['id'];

/** Opción del desplegable «Tamaño»: según la imagen, un tamaño predefinido o personalizado. */
export type CardSizeChoice = 'image' | CardPresetId | 'custom';

type SizeFields = Pick<
  LayoutSettings,
  'forceWidth' | 'forceHeight' | 'cardWidthMm' | 'cardHeightMm'
>;

/** Deduce la opción a partir de la configuración, sin guardar nada más en el modelo. */
export function cardSizeChoice(s: SizeFields): CardSizeChoice {
  if (!s.forceWidth && !s.forceHeight) return 'image';
  if (!s.forceWidth || !s.forceHeight) return 'custom';
  const preset = CARD_PRESETS.find(
    (p) => p.widthMm === s.cardWidthMm && p.heightMm === s.cardHeightMm,
  );
  return preset?.id ?? 'custom';
}

/** Configuración que aplica un tamaño predefinido: fuerza ancho y alto. */
export function presetSettings(id: CardPresetId): SizeFields {
  const p = CARD_PRESETS.find((preset) => preset.id === id)!;
  return { forceWidth: true, forceHeight: true, cardWidthMm: p.widthMm, cardHeightMm: p.heightMm };
}
