import { bleedRects } from './bleed';
import { DEFAULT_SETTINGS } from './settings';

const on = (mm: number) => ({ ...DEFAULT_SETTINGS, bleed: { enabled: true, mm, color: '#fff' } });

describe('bleedRects', () => {
  it('rodea cada carta con cuatro bandas del ancho del margen de corte', () => {
    // 25,4 mm = 72 pt
    const rects = bleedRects([{ x: 100, y: 200, width: 150, height: 250 }], on(25.4));
    expect(rects).toEqual([
      { x: 28, y: 128, width: 72, height: 394 }, // izquierda
      { x: 250, y: 128, width: 72, height: 394 }, // derecha
      { x: 100, y: 128, width: 150, height: 72 }, // abajo
      { x: 100, y: 450, width: 150, height: 72 }, // arriba
    ]);
  });

  it('dibuja bandas solo para las cartas colocadas en la página', () => {
    const card = { x: 0, y: 0, width: 10, height: 10 };
    expect(bleedRects([card, card, card], on(2))).toHaveLength(12);
  });

  it('no dibuja nada si el margen de corte está desactivado', () => {
    expect(bleedRects([{ x: 0, y: 0, width: 10, height: 10 }], DEFAULT_SETTINGS)).toEqual([]);
  });
});
