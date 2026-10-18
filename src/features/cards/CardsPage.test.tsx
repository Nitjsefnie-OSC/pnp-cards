import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';
import { useCardsStore, type NewImage } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { CardTray } from './CardTray';
import { CardsPage } from './CardsPage';
import { SettingsPanel } from './SettingsPanel';

function fakeImage(name: string, dpi: NewImage['dpi'] = { x: 300, y: 300 }): NewImage {
  return {
    name,
    blob: new Blob(['x'], { type: 'image/png' }),
    format: 'png',
    widthPx: 744,
    heightPx: 1039,
    dpi,
    thumbUrl: null,
  };
}

const file = (name: string) => new File(['x'], name, { type: 'image/png' });

beforeAll(() => i18n.changeLanguage('es'));
beforeEach(() => {
  useCardsStore.getState().clear();
  useSettingsStore.getState().reset();
});

describe('CardTray', () => {
  it('invita a añadir imágenes cuando la lista está vacía', () => {
    render(<CardTray />);
    expect(screen.getByText(/Arrastra aquí las imágenes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imagen en blanco' })).toBeDisabled();
  });

  it('añade las imágenes elegidas y cuenta archivos y cartas', async () => {
    const user = userEvent.setup();
    const loadImages = vi.fn(async (files: File[]) => ({
      images: files.map((f) => fakeImage(f.name)),
      failed: [],
    }));
    render(<CardTray loadImages={loadImages} />);

    await user.upload(screen.getByTestId('file-input'), [file('a.png'), file('b x3.png')]);

    expect(await screen.findByText('2 archivos / 4 cartas')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('cambia las copias, añade una imagen en blanco y quita cartas', async () => {
    const user = userEvent.setup();
    useCardsStore.getState().addImages([fakeImage('a.png')]);
    render(<CardTray />);

    const copies = screen.getByLabelText('Copias de a.png');
    await user.clear(copies);
    await user.type(copies, '5');
    expect(screen.getByText('1 archivo / 5 cartas')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Imagen en blanco' }));
    expect(screen.getByText('2 archivos / 6 cartas')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Quitar a.png' }));
    const [tile] = screen.getAllByRole('listitem');
    expect(within(tile).getByText('En blanco')).toBeInTheDocument();
  });

  it('avisa de las imágenes que no se han podido leer', async () => {
    const user = userEvent.setup();
    const loadImages = async () => ({ images: [], failed: ['roto.png'] });
    render(<CardTray loadImages={loadImages} />);
    await user.upload(screen.getByTestId('file-input'), [file('roto.png')]);
    expect(await screen.findByRole('alert')).toHaveTextContent('roto.png');
  });
});

describe('SettingsPanel', () => {
  it('muestra columnas y filas solo en modo manual', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    expect(screen.queryByLabelText('Columnas')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Manual'));
    expect(screen.getByLabelText('Columnas')).toHaveValue('3');
  });

  it('guarda el margen escrito con coma decimal', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    const margin = screen.getByLabelText('Margen de la página');
    await user.clear(margin);
    await user.type(margin, '5,5');
    expect(useSettingsStore.getState().settings.marginMm).toBe(5.5);
  });
});

describe('CardsPage', () => {
  it('avisa de imágenes sin ppp hasta que se fuerza el tamaño', async () => {
    const user = userEvent.setup();
    useCardsStore.getState().addImages([fakeImage('a.png', null)]);
    render(<CardsPage />);
    expect(screen.getByText(/no indican su resolución/)).toBeInTheDocument();

    await user.click(screen.getByText('Tamaño de la carta'));
    await user.click(screen.getByLabelText('Forzar ancho'));
    expect(screen.queryByText(/no indican su resolución/)).not.toBeInTheDocument();
  });

  it('calcula las páginas según la distribución', () => {
    useCardsStore.getState().addImages([fakeImage('a x10.png')]);
    render(<CardsPage />);
    expect(screen.getByText('2 páginas')).toBeInTheDocument();
  });
});
