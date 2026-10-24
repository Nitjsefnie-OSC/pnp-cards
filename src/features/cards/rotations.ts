import type { TFunction } from 'i18next';
import { autoRotatedCards, effectiveRotations } from '../../lib/rotation';
import type { LayoutSettings } from '../../lib/settings';
import type { Rotation } from '../../lib/template';
import type { CardImage } from '../../store/cardsStore';

const rotatable = (cards: CardImage[]) => cards.map((c) => ({ ...c, blank: c.blob === null }));

/** Giro con el que sale cada carta de la lista en la página. */
export const rotationsOf = (settings: LayoutSettings, cards: CardImage[]) =>
  effectiveRotations(settings, rotatable(cards));

/** Qué cartas de la lista gira el giro automático. */
export const autoRotatedOf = (settings: LayoutSettings, cards: CardImage[]) =>
  autoRotatedCards(settings, rotatable(cards));

/** Nombre de un giro para la interfaz: 90° es a la izquierda (antihorario) y 270°, a la derecha. */
export function rotationLabel(t: TFunction, rotation: Rotation) {
  return t(
    rotation === 90
      ? 'cardInfo.rotationLeft'
      : rotation === 270
        ? 'cardInfo.rotationRight'
        : rotation === 180
          ? 'cardInfo.rotationHalf'
          : 'cardInfo.rotationNone',
  );
}
