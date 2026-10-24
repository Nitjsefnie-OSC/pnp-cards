import {
  autoRotated,
  autoRotation,
  cardRotations,
  effectiveRotations,
  isLandscape,
  layoutLandscape,
} from './rotation';
import { DEFAULT_SETTINGS, type LayoutSettings } from './settings';
import type { TemplateSlot } from './template';

const settings = (over: Partial<LayoutSettings> = {}): LayoutSettings => ({
  ...DEFAULT_SETTINGS,
  autoRotate: true,
  ...over,
});
const portrait = { widthPx: 744, heightPx: 1039, copies: 1, blank: false };
const landscape = { widthPx: 1039, heightPx: 744, copies: 1, blank: false };
const square = { widthPx: 800, heightPx: 800, copies: 1, blank: false };
const blank = { widthPx: 0, heightPx: 0, copies: 1, blank: true };
const forced = (widthMm: number, heightMm: number) =>
  settings({ forceWidth: true, forceHeight: true, cardWidthMm: widthMm, cardHeightMm: heightMm });
const noCrops = (n: number) => Array<null>(n).fill(null);

describe('isLandscape', () => {
  it('distingue horizontal, vertical y cuadrada', () => {
    expect(isLandscape({ width: 88, height: 63 })).toBe(true);
    expect(isLandscape({ width: 63, height: 88 })).toBe(false);
    expect(isLandscape({ width: 70, height: 70 })).toBeNull();
  });
});

describe('layoutLandscape', () => {
  it('con ancho y alto forzados manda el tamaño forzado', () => {
    expect(layoutLandscape(forced(88, 63), [portrait], noCrops(1))).toBe(true);
    expect(layoutLandscape(forced(63, 88), [landscape], noCrops(1))).toBe(false);
    expect(layoutLandscape(forced(70, 70), [landscape], noCrops(1))).toBeNull();
  });

  it('si no, es la orientación de la mayoría de las cartas, contando copias', () => {
    const cards = [portrait, { ...landscape, copies: 3 }];
    expect(layoutLandscape(settings(), cards, noCrops(2))).toBe(true);
    expect(layoutLandscape(settings(), [{ ...portrait, copies: 4 }, landscape], noCrops(2))).toBe(
      false,
    );
  });

  it('en empate, vertical', () => {
    expect(layoutLandscape(settings(), [portrait, landscape], noCrops(2))).toBe(false);
  });

  it('no cuenta las imágenes en blanco ni las cuadradas', () => {
    expect(layoutLandscape(settings(), [blank, square, landscape], noCrops(3))).toBe(true);
    expect(layoutLandscape(settings(), [blank, square], noCrops(2))).toBeNull();
  });

  it('una carta girada a mano cuenta con su orientación ya girada', () => {
    const turned = { ...landscape, copies: 2, rotation: 90 as const };
    expect(layoutLandscape(settings(), [turned, portrait], noCrops(2))).toBe(false);
  });

  it('con recorte, cuenta la forma del recorte', () => {
    const crop = { x: 0, y: 0, width: 500, height: 700 };
    expect(layoutLandscape(settings(), [landscape], [crop])).toBe(false);
  });
});

describe('autoRotation', () => {
  it('una carta con giro propio lo conserva', () => {
    expect(autoRotation(true, 90, true, false)).toBe(90);
    expect(autoRotation(true, 180, false, false)).toBe(180);
  });

  it('gira 90° a la derecha la carta cuya orientación no es la de la distribución', () => {
    expect(autoRotation(true, undefined, true, false)).toBe(270);
    expect(autoRotation(true, 0, false, true)).toBe(270);
  });

  it('no gira si la orientación coincide, si es cuadrada o si la distribución no tiene', () => {
    expect(autoRotation(true, 0, false, false)).toBe(0);
    expect(autoRotation(true, 0, null, false)).toBe(0);
    expect(autoRotation(true, 0, true, null)).toBe(0);
  });

  it('desactivado, no gira', () => {
    expect(autoRotation(false, 0, true, false)).toBe(0);
  });
});

describe('cardRotations', () => {
  it('gira las cartas horizontales de una distribución vertical', () => {
    const cards = [{ ...portrait, copies: 2 }, landscape, blank];
    expect(cardRotations(settings(), cards, noCrops(3))).toEqual([0, 270, 0]);
  });

  it('con un tamaño forzado horizontal, gira las verticales', () => {
    expect(cardRotations(forced(88, 63), [portrait, landscape], noCrops(2))).toEqual([270, 0]);
  });

  it('respeta el giro elegido a mano', () => {
    const cards = [portrait, { ...landscape, rotation: 90 as const }];
    expect(cardRotations(settings(), cards, noCrops(2))).toEqual([0, 90]);
  });
});

describe('effectiveRotations', () => {
  it('en cuadrícula es el giro elegido o el automático; con plantilla, solo el elegido', () => {
    const cards = [portrait, landscape, { ...landscape, rotation: 90 as const }];
    expect(effectiveRotations(settings(), cards)).toEqual([0, 270, 90]);
    const slot = { id: 'a', xMm: 0, yMm: 0, widthMm: 63, heightMm: 88, rotation: 0 as const };
    const tpl = settings({
      mode: 'template',
      template: { id: 't', name: 't', pageMm: { width: 210, height: 297 }, slots: [slot] },
    });
    expect(effectiveRotations(tpl, cards)).toEqual([0, 0, 90]);
  });
});

describe('autoRotated', () => {
  it('dice si el giro automático gira una carta en la distribución', () => {
    const cards = [{ ...portrait, copies: 2 }, landscape];
    expect(autoRotated(settings(), cards, 1)).toBe(true);
    expect(autoRotated(settings(), cards, 0)).toBe(false);
    expect(autoRotated(settings({ autoRotate: false }), cards, 1)).toBe(false);
  });

  it('con plantilla, si la gira en alguno de sus huecos', () => {
    const slot: TemplateSlot = { id: 'a', xMm: 0, yMm: 0, widthMm: 63, heightMm: 88, rotation: 0 };
    const wide = { ...slot, id: 'b', widthMm: 88, heightMm: 63 };
    const template = (slots: TemplateSlot[]) =>
      settings({
        mode: 'template',
        template: { id: 't', name: 't', pageMm: { width: 210, height: 297 }, slots },
      });
    expect(autoRotated(template([slot]), [landscape], 0)).toBe(true);
    expect(autoRotated(template([slot, wide]), [portrait], 0)).toBe(true);
    // Un hueco de 88 × 63 girado 90° recibe la carta en vertical.
    expect(autoRotated(template([{ ...wide, rotation: 90 }]), [portrait], 0)).toBe(false);
  });
});
