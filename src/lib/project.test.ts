import { parseProject, ProjectError, serializeProject, type ProjectFile } from './project';
import { DEFAULT_SETTINGS } from './settings';

const project: ProjectFile = {
  name: 'Mi juego',
  folder: 'cartas',
  settings: { ...DEFAULT_SETTINGS, marginMm: 5 },
  cards: [
    { path: 'heroes/elfo x3.png', name: 'elfo x3.png', copies: 3 },
    { path: '', name: '', copies: 2 },
  ],
};

describe('archivo .pnpcards', () => {
  it('es un JSON legible con el formato, la versión y las cartas, sin imágenes', () => {
    const json = JSON.parse(serializeProject(project));
    expect(json).toMatchObject({
      format: 'pnp-cards',
      version: 1,
      name: 'Mi juego',
      folder: 'cartas',
    });
    expect(json.cards).toEqual([
      { path: 'heroes/elfo x3.png', name: 'elfo x3.png', copies: 3 },
      { path: '', name: '', copies: 2 },
    ]);
  });

  it('al guardarlo y abrirlo se recupera el mismo proyecto', () => {
    expect(parseProject(serializeProject(project))).toEqual(project);
  });

  it('completa con los valores por defecto la configuración que falte', () => {
    const p = parseProject(
      JSON.stringify({ format: 'pnp-cards', version: 1, settings: { marginMm: 3 }, cards: [] }),
    );
    expect(p.settings).toEqual({ ...DEFAULT_SETTINGS, marginMm: 3 });
    expect(p.name).toBe('');
    expect(p.folder).toBe('');
  });

  it('corrige copias no válidas a una', () => {
    const p = parseProject(
      JSON.stringify({
        format: 'pnp-cards',
        version: 1,
        cards: [{ path: 'a.png', name: 'a.png', copies: 0 }],
      }),
    );
    expect(p.cards[0].copies).toBe(1);
  });

  it('rechaza archivos que no son proyectos', () => {
    expect(() => parseProject('hola')).toThrow(ProjectError);
    expect(() => parseProject('{"foo": 1}')).toThrow(ProjectError);
  });

  it('avisa si el proyecto es de una versión más nueva de la app', () => {
    try {
      parseProject(JSON.stringify({ format: 'pnp-cards', version: 99, cards: [] }));
      expect.unreachable();
    } catch (err) {
      expect(err).toMatchObject({ code: 'newer-version' });
    }
  });
});
