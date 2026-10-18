import type { NewImage } from '../../store/cardsStore';
import { fitRegion, useSplitStore } from './splitStore';

const image = (name: string, widthPx = 900, heightPx = 1200): NewImage => ({
  name,
  path: name,
  blob: new Blob(['x']),
  format: 'png',
  widthPx,
  heightPx,
  dpi: null,
  thumbUrl: null,
});

const store = () => useSplitStore.getState();

describe('splitStore', () => {
  beforeEach(() => {
    store().clear();
    store().setSameForAll(true);
  });

  it('cada imagen empieza con la imagen entera en 3 × 3, y se selecciona la primera', () => {
    store().add([image('a.png'), image('b.png')]);
    expect(store().items[0]).toMatchObject({
      region: { x: 0, y: 0, width: 900, height: 1200 },
      columns: 3,
      rows: 3,
    });
    expect(store().selectedId).toBe(store().items[0].id);
  });

  it('con «mismos ajustes», cambiar una imagen cambia todas, ajustando la zona a cada una', () => {
    store().add([image('a.png'), image('b.png', 600, 800)]);
    const [a] = store().items;
    store().update(a.id, { columns: 4, region: { x: 100, y: 50, width: 700, height: 1000 } });
    const [, b] = store().items;
    expect(b.columns).toBe(4);
    expect(b.region).toEqual({ x: 0, y: 0, width: 600, height: 800 });
  });

  it('sin «mismos ajustes», cada imagen tiene los suyos', () => {
    store().setSameForAll(false);
    store().add([image('a.png'), image('b.png')]);
    store().update(store().items[0].id, { rows: 2 });
    expect(store().items.map((i) => i.rows)).toEqual([2, 3]);
  });

  it('al quitar la imagen seleccionada se selecciona la siguiente', () => {
    store().add([image('a.png'), image('b.png')]);
    const [a, b] = store().items;
    store().remove(a.id);
    expect(store().selectedId).toBe(b.id);
  });
});

describe('fitRegion', () => {
  it('mete la zona dentro de la imagen sin cambiar su tamaño si cabe', () => {
    expect(fitRegion({ x: 800, y: -20, width: 300, height: 300 }, 1000, 1000)).toEqual({
      x: 700,
      y: 0,
      width: 300,
      height: 300,
    });
  });

  it('recorta una zona más grande que la imagen', () => {
    expect(fitRegion({ x: 0, y: 0, width: 2000, height: 50 }, 1000, 1000)).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 50,
    });
  });
});
