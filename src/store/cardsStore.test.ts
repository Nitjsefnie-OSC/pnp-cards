import { useCardsStore, totalCards, type CardImage } from './cardsStore';

function image(name: string, over: Partial<CardImage> = {}): Omit<CardImage, 'id' | 'copies'> {
  return {
    name,
    path: name,
    blob: new Blob(['x'], { type: 'image/png' }),
    format: 'png',
    widthPx: 744,
    heightPx: 1039,
    dpi: null,
    thumbUrl: null,
    ...over,
  };
}

const store = () => useCardsStore.getState();

describe('cardsStore', () => {
  beforeEach(() => store().clear());

  it('añade cartas con una copia, o las indicadas con " xN" en el nombre', () => {
    store().addImages([image('a.png'), image('b x3.png')]);
    expect(store().cards.map((c) => [c.name, c.copies])).toEqual([
      ['a.png', 1],
      ['b x3.png', 3],
    ]);
  });

  it('cuenta el total de cartas sumando las copias', () => {
    store().addImages([image('a x2.png'), image('b x3.png')]);
    expect(totalCards(store().cards)).toBe(5);
  });

  it('cambia las copias de una carta, con un mínimo de una', () => {
    store().addImages([image('a.png')]);
    const id = store().cards[0].id;
    store().setCopies(id, 7);
    expect(store().cards[0].copies).toBe(7);
    store().setCopies(id, 0);
    expect(store().cards[0].copies).toBe(1);
  });

  it('añade una imagen en blanco al final', () => {
    store().addImages([image('a.png')]);
    store().addBlank();
    expect(store().cards[1]).toMatchObject({ blob: null, copies: 1 });
  });

  it('quita cartas', () => {
    store().addImages([image('a.png'), image('b.png')]);
    store().remove(store().cards[0].id);
    expect(store().cards.map((c) => c.name)).toEqual(['b.png']);
  });

  it('deshace la última carta quitada, en su posición', () => {
    store().addImages([image('a.png'), image('b.png'), image('c.png')]);
    store().remove(store().cards[1].id);
    expect(store().lastRemoved?.card.name).toBe('b.png');
    store().undoRemove();
    expect(store().cards.map((c) => c.name)).toEqual(['a.png', 'b.png', 'c.png']);
    expect(store().lastRemoved).toBeNull();
  });

  it('mueve una carta a la posición de otra', () => {
    store().addImages([image('a.png'), image('b.png'), image('c.png')]);
    const [a, , c] = store().cards;
    store().move(a.id, c.id);
    expect(store().cards.map((x) => x.name)).toEqual(['b.png', 'c.png', 'a.png']);
  });

  it('carga un proyecto entero: nombre y cartas con sus copias', () => {
    store().addImages([image('vieja.png')]);
    store().load(
      'Mi juego',
      [
        { ...image('a.png'), copies: 4 },
        { ...image(''), blob: null, copies: 2 },
      ],
      { name: 'cartas', handle: null },
    );
    expect(store().name).toBe('Mi juego');
    expect(store().folder).toEqual({ name: 'cartas', handle: null });
    expect(store().cards.map((c) => [c.name, c.copies, c.blob === null])).toEqual([
      ['a.png', 4, false],
      ['', 2, true],
    ]);
    expect(store().lastRemoved).toBeNull();
  });

  it('empezar un proyecto nuevo vacía la lista y el nombre', () => {
    store().load('Mi juego', [{ ...image('a.png'), copies: 1 }], null);
    store().reset();
    expect(store().name).toBe('');
    expect(store().folder).toBeNull();
    expect(store().cards).toEqual([]);
  });

  it('una carta que falta guarda su ruta y sus copias, sin imagen', () => {
    store().load(
      'x',
      [{ ...image('elfo.png'), path: 'heroes/elfo.png', blob: null, missing: true, copies: 3 }],
      null,
    );
    expect(store().cards[0]).toMatchObject({ path: 'heroes/elfo.png', missing: true, copies: 3 });
  });

  it('al encontrar la imagen de una carta que falta, la sustituye y conserva copias y ruta', () => {
    store().load(
      'x',
      [{ ...image('elfo.png'), path: 'heroes/elfo.png', blob: null, missing: true, copies: 3 }],
      null,
    );
    const id = store().cards[0].id;
    store().replaceImage(id, image('elfo.png'));
    expect(store().cards[0]).toMatchObject({
      id,
      path: 'heroes/elfo.png',
      copies: 3,
      missing: false,
    });
    expect(store().cards[0].blob).not.toBeNull();
  });

  it('si la imagen encontrada tiene otro nombre, usa su nombre como ruta', () => {
    store().load(
      'x',
      [{ ...image('elfo.png'), path: 'heroes/elfo.png', blob: null, missing: true, copies: 1 }],
      null,
    );
    store().replaceImage(store().cards[0].id, image('elfo-v2.png'));
    expect(store().cards[0]).toMatchObject({ name: 'elfo-v2.png', path: 'elfo-v2.png' });
  });
});
