import { cropRect, type PxRect } from './crop';
import type { LayoutSettings } from './settings';
import { slotLocalSize, type Rotation } from './template';

/** Lo que hace falta de una carta para decidir su giro. */
export interface RotatableCard {
  widthPx: number;
  heightPx: number;
  copies: number;
  blank: boolean;
  /** Giro elegido para la carta (antihorario). Sin giro (0 o ausente), decide el automático. */
  rotation?: Rotation;
}

/**
 * Giro automático: un cuarto de vuelta a la derecha (en sentido horario, como el botón de girar
 * de los visores de imágenes), que en el sentido antihorario de las plantillas es 270°.
 */
export const AUTO_ROTATION: Rotation = 270;

interface Shape {
  width: number;
  height: number;
}

/** true si es horizontal (más ancha que alta), false si vertical y null si cuadrada. */
export function isLandscape(shape: Shape): boolean | null {
  if (shape.width === shape.height) return null;
  return shape.width > shape.height;
}

/** Forma visible de la carta: la del recorte, si lo hay; si no, la de la imagen. */
function visibleShape(card: RotatableCard, crop: PxRect | null): Shape {
  return crop
    ? { width: crop.width, height: crop.height }
    : { width: card.widthPx, height: card.heightPx };
}

/** Orientación con la que sale la carta tras su giro propio (el automático no cuenta aquí). */
function ownLandscape(card: RotatableCard, crop: PxRect | null): boolean | null {
  const landscape = isLandscape(visibleShape(card, crop));
  const quarter = card.rotation === 90 || card.rotation === 270;
  return landscape === null || !quarter ? landscape : !landscape;
}

/**
 * Orientación de la distribución: la del tamaño forzado (ancho y alto) o, si no, la de la mayoría
 * de las cartas, contando copias y con los giros elegidos a mano; las imágenes en blanco y las
 * cuadradas no cuentan. En empate, vertical. Null si no hay orientación (todo cuadrado).
 */
export function layoutLandscape(
  settings: LayoutSettings,
  cards: RotatableCard[],
  crops: (PxRect | null)[],
): boolean | null {
  if (settings.forceWidth && settings.forceHeight) {
    return isLandscape({ width: settings.cardWidthMm, height: settings.cardHeightMm });
  }
  let landscape = 0;
  let portrait = 0;
  cards.forEach((card, i) => {
    if (card.blank || card.copies <= 0) return;
    const own = ownLandscape(card, crops[i]);
    if (own === true) landscape += card.copies;
    else if (own === false) portrait += card.copies;
  });
  if (landscape === 0 && portrait === 0) return null;
  return landscape > portrait;
}

/**
 * Giro de una carta: el elegido a mano o, si no tiene y el giro automático está activado, un
 * cuarto de vuelta cuando su orientación no es la del hueco (`target`).
 */
export function autoRotation(
  enabled: boolean,
  own: Rotation | undefined,
  cardLandscape: boolean | null,
  targetLandscape: boolean | null,
): Rotation {
  const rotation = own ?? 0;
  if (!enabled || rotation !== 0) return rotation;
  if (cardLandscape === null || targetLandscape === null) return 0;
  return cardLandscape === targetLandscape ? 0 : AUTO_ROTATION;
}

/** Giro de cada carta en una distribución en cuadrícula (sin plantilla). */
export function cardRotations(
  settings: LayoutSettings,
  cards: RotatableCard[],
  crops: (PxRect | null)[],
): Rotation[] {
  const target = layoutLandscape(settings, cards, crops);
  return cards.map((card, i) =>
    autoRotation(
      settings.autoRotate,
      card.rotation,
      card.blank ? null : isLandscape(visibleShape(card, crops[i])),
      target,
    ),
  );
}

/** Giro de una carta en un hueco de plantilla: según la orientación de la carta sin girar en él. */
export function slotRotation(
  settings: LayoutSettings,
  card: RotatableCard,
  crop: PxRect | null,
  slotLocal: Shape,
): Rotation {
  return autoRotation(
    settings.autoRotate,
    card.rotation,
    card.blank ? null : isLandscape(visibleShape(card, crop)),
    isLandscape(slotLocal),
  );
}

function visibleCrops(settings: LayoutSettings, cards: RotatableCard[]): (PxRect | null)[] {
  return cards.map((card) =>
    settings.crop.enabled && !card.blank ? cropRect(card, settings.crop) : null,
  );
}

/**
 * Giro con el que sale cada carta en la página, para la lista y la información de las cartas: en
 * cuadrícula, el elegido o el automático; con plantilla, solo el elegido (el automático se decide
 * en cada hueco y lo cuenta `printedDpi`).
 */
export function effectiveRotations(settings: LayoutSettings, cards: RotatableCard[]): Rotation[] {
  if (settings.mode === 'template') return cards.map((card) => card.rotation ?? 0);
  return cardRotations(settings, cards, visibleCrops(settings, cards));
}

/** Si el giro automático gira cada carta (con plantilla, en alguno de sus huecos). */
export function autoRotatedCards(settings: LayoutSettings, cards: RotatableCard[]): boolean[] {
  if (!settings.autoRotate) return cards.map(() => false);
  const crops = visibleCrops(settings, cards);
  const eligible = (card: RotatableCard) => !card.blank && (card.rotation ?? 0) === 0;
  if (settings.mode === 'template') {
    const locals = (settings.template?.slots ?? []).map((slot) =>
      slotLocalSize({ x: 0, y: 0, width: slot.widthMm, height: slot.heightMm }, slot.rotation),
    );
    return cards.map(
      (card, i) =>
        eligible(card) &&
        locals.some((local) => slotRotation(settings, card, crops[i], local) !== 0),
    );
  }
  const rotations = cardRotations(settings, cards, crops);
  return cards.map((card, i) => eligible(card) && rotations[i] !== 0);
}

/** Si el giro automático gira la carta `index`. */
export function autoRotated(settings: LayoutSettings, cards: RotatableCard[], index: number) {
  return autoRotatedCards(settings, cards)[index];
}
