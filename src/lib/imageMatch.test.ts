import { matchImages, normalizePath } from './imageMatch';

const entry = (path: string) => ({ path, file: new File(['x'], path.split('/').pop()!) });

describe('normalizePath', () => {
  it('usa barras normales, quita la barra inicial y no distingue mayúsculas', () => {
    expect(normalizePath('\\Img\\Héroe x3.PNG')).toBe('img/héroe x3.png');
    expect(normalizePath('./a/b.png')).toBe('a/b.png');
  });
});

describe('matchImages', () => {
  const folder = [entry('heroes/elfo.png'), entry('monstruos/elfo.png'), entry('orco.jpg')];

  it('busca primero por la ruta dentro de la carpeta', () => {
    const { matched } = matchImages([{ path: 'monstruos/elfo.png', name: 'elfo.png' }], folder);
    expect(matched[0].file).toBe(folder[1].file);
  });

  it('acepta que se elija la carpeta de dentro o la de fuera', () => {
    // Proyecto guardado con rutas relativas a "juego", y se elige "juego/heroes" o "padre".
    expect(
      matchImages([{ path: 'heroes/elfo.png', name: 'elfo.png' }], [entry('elfo.png')]).matched[0]
        .file,
    ).not.toBeNull();
    expect(
      matchImages([{ path: 'orco.jpg', name: 'orco.jpg' }], [entry('juego/orco.jpg')]).matched[0]
        .file?.name,
    ).toBe('orco.jpg');
  });

  it('si la ruta no aparece, busca por nombre', () => {
    const { matched, missing } = matchImages([{ path: 'otra/orco.jpg', name: 'orco.jpg' }], folder);
    expect(matched[0].file).toBe(folder[2].file);
    expect(missing).toEqual([]);
  });

  it('las imágenes en blanco no se buscan ni faltan', () => {
    const { matched, missing } = matchImages([{ path: '', name: '' }], folder);
    expect(matched[0].file).toBeNull();
    expect(missing).toEqual([]);
  });

  it('lista las imágenes que no encuentra', () => {
    const { missing } = matchImages(
      [
        { path: 'heroes/mago.png', name: 'mago.png' },
        { path: 'orco.jpg', name: 'orco.jpg' },
      ],
      folder,
    );
    expect(missing).toEqual(['heroes/mago.png']);
  });

  it('las rutas de PDFCartas (con \\ y barra inicial) también valen', () => {
    const { matched } = matchImages([{ path: '\\heroes\\elfo.png', name: 'elfo.png' }], folder);
    expect(matched[0].file).toBe(folder[0].file);
  });
});
