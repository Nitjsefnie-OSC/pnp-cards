import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n';
import { useCardsStore, type NewImage } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { BackSettings } from './BackSettings';
import { CardTray } from './CardTray';

const backImage: NewImage = {
  name: 'dorso.png',
  path: 'dorso.png',
  blob: new Blob(['x'], { type: 'image/png' }),
  format: 'png',
  widthPx: 750,
  heightPx: 1050,
  dpi: { x: 300, y: 300 },
  thumbUrl: 'blob:dorso',
};

const png = (name: string) => new File(['x'], name, { type: 'image/png' });

/** La sección está plegada: se abre para ver su contenido. */
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('Reverso'));
}

beforeAll(() => i18n.changeLanguage('es'));
beforeEach(() => {
  useCardsStore.getState().reset();
  useSettingsStore.getState().reset();
  URL.revokeObjectURL = vi.fn();
});

describe('BackSettings', () => {
  it('activa los reversos, elige la imagen y muestra su nombre y tamaño', async () => {
    const user = userEvent.setup();
    const loadImage = vi.fn(async () => backImage);
    render(<BackSettings loadImage={loadImage} />, { wrapper: MemoryRouter });
    await open(user);

    await user.click(screen.getByLabelText(/Añadir reversos/));
    expect(useSettingsStore.getState().settings.backs.enabled).toBe(true);
    expect(screen.getByText('Todavía no has elegido la imagen del reverso.')).toBeInTheDocument();

    await user.upload(screen.getByTestId('back-input'), png('dorso.png'));
    expect(loadImage).toHaveBeenCalled();
    expect(useCardsStore.getState().back).toBe(backImage);
    expect(screen.getByText('dorso.png')).toBeInTheDocument();
    expect(screen.getByText('750 × 1050 px')).toBeInTheDocument();
    // El reverso no es una carta.
    expect(useCardsStore.getState().cards).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(useCardsStore.getState().back).toBeNull();
  });

  it('elige por qué borde se da la vuelta al papel', async () => {
    const user = userEvent.setup();
    useSettingsStore.getState().update({ backs: { enabled: true, flip: 'long' } });
    render(<BackSettings />, { wrapper: MemoryRouter });
    await open(user);
    await user.click(screen.getByLabelText('Por el borde corto'));
    expect(useSettingsStore.getState().settings.backs.flip).toBe('short');
  });

  it('descarga la hoja de prueba con el volteo elegido y guarda el ajuste de la impresora', async () => {
    const user = userEvent.setup();
    useSettingsStore.getState().update({ backs: { enabled: true, flip: 'short' } });
    const buildSheet = vi.fn(async () => new Uint8Array([1, 2, 3]));
    URL.createObjectURL = vi.fn(() => 'blob:sheet');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<BackSettings buildSheet={buildSheet} />, { wrapper: MemoryRouter });
    await open(user);

    await user.click(screen.getByRole('button', { name: 'Descargar hoja de prueba' }));
    expect(buildSheet).toHaveBeenCalledWith(
      expect.objectContaining({ backs: { enabled: true, flip: 'short' } }),
      expect.objectContaining({
        title: 'Hoja de prueba de alineación',
        flip: 'Volteo del papel: por el borde corto',
        right: 'Mover reverso a la derecha (mm)',
      }),
    );
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));

    const right = screen.getByLabelText('Mover reverso a la derecha');
    await user.clear(right);
    await user.type(right, '1,5');
    const up = screen.getByLabelText('Mover reverso hacia arriba');
    await user.clear(up);
    await user.type(up, '-0.5');
    expect(useSettingsStore.getState().settings.backOffsetMm).toEqual({ x: 1.5, y: -0.5 });
    // El ajuste de la impresora sobrevive a reset(): se limpia a mano para los demás tests.
    useSettingsStore.getState().update({ backOffsetMm: { x: 0, y: 0 } });
  });

  it('avisa si la hoja de prueba no se puede generar', async () => {
    const user = userEvent.setup();
    useSettingsStore.getState().update({ backs: { enabled: true, flip: 'long' } });
    render(<BackSettings buildSheet={() => Promise.reject(new Error('roto'))} />, {
      wrapper: MemoryRouter,
    });
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Descargar hoja de prueba' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se ha podido generar la hoja de prueba.',
    );
  });

  it('avisa si la imagen no se puede leer', async () => {
    const user = userEvent.setup();
    useSettingsStore.getState().update({ backs: { enabled: true, flip: 'long' } });
    render(<BackSettings loadImage={() => Promise.reject(new Error('roto'))} />, {
      wrapper: MemoryRouter,
    });
    await open(user);
    await user.upload(screen.getByTestId('back-input'), png('roto.png'));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido leer roto.png.');
  });

  it('avisa si el reverso del proyecto no se encuentra', async () => {
    const user = userEvent.setup();
    useSettingsStore.getState().update({ backs: { enabled: true, flip: 'long' } });
    useCardsStore.getState().setBack({ ...backImage, blob: null, thumbUrl: null, missing: true });
    render(<BackSettings />, { wrapper: MemoryRouter });
    await open(user);
    expect(screen.getByText('No se encuentra dorso.png. Elígela otra vez.')).toBeInTheDocument();
  });
});

describe('carta sin reverso', () => {
  it('se marca desde su información y se indica en la tarjeta', async () => {
    const user = userEvent.setup();
    useCardsStore.getState().addImages([{ ...backImage, name: 'mapa.png', path: 'mapa.png' }]);
    render(<CardTray />, { wrapper: MemoryRouter });

    // Sin reversos activados, no se ofrece.
    await user.click(screen.getByRole('button', { name: 'Información de mapa.png' }));
    expect(screen.queryByLabelText('Sin reverso')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    useSettingsStore.getState().update({ backs: { enabled: true, flip: 'long' } });
    await user.click(screen.getByRole('button', { name: 'Información de mapa.png' }));
    await user.click(screen.getByLabelText('Sin reverso'));
    expect(useCardsStore.getState().cards[0].noBack).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.getByText('Sin reverso')).toBeInTheDocument();
  });
});
