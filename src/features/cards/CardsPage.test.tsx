import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n';
import { useCardsStore, type NewImage } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { CardTray } from './CardTray';
import { CardsPage } from './CardsPage';
import { ConfirmHost } from '../../components/ConfirmHost';
import { SettingsPanel } from './SettingsPanel';
import { useTemplatesStore } from '../templates/templatesStore';

function fakeImage(name: string, dpi: NewImage['dpi'] = { x: 300, y: 300 }): NewImage {
  return {
    name,
    path: name,
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
    const loadImages = vi.fn(async (entries: { path: string }[]) => ({
      images: entries.map((e) => fakeImage(e.path)),
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

  it('los botones − y + quitan y añaden copias; − no baja de una', async () => {
    const user = userEvent.setup();
    useCardsStore.getState().addImages([fakeImage('a.png')]);
    render(<CardTray />);

    expect(screen.getByText('Número de copias')).toBeInTheDocument();
    const minus = screen.getByRole('button', { name: 'Quitar una copia de a.png' });
    const plus = screen.getByRole('button', { name: 'Añadir una copia de a.png' });
    expect(minus).toBeDisabled();

    await user.click(plus);
    await user.click(plus);
    expect(screen.getByLabelText('Copias de a.png')).toHaveValue('3');
    await user.click(minus);
    expect(useCardsStore.getState().cards[0].copies).toBe(2);
  });

  it('muestra la información de cada carta y se cierra con Esc', async () => {
    const user = userEvent.setup();
    useCardsStore.getState().addImages([
      {
        ...fakeImage('héroe con un nombre largo.png'),
        sourceFormat: 'webp',
        fileBytes: 2_400_000,
      },
      fakeImage('b.png', null),
    ]);
    render(<CardTray />);

    const button = screen.getByRole('button', {
      name: 'Información de héroe con un nombre largo.png',
    });
    await user.click(button);
    const panel = screen.getByRole('dialog', { name: /Información de héroe/ });
    expect(panel).toHaveTextContent('WebP, convertida a PNG al cargarla');
    expect(panel).toHaveTextContent('744 × 1039 px');
    expect(panel).toHaveTextContent('300 ppp');
    expect(panel).toHaveTextContent('63,0 × 88,0 mm');
    expect(panel).toHaveTextContent('Igual que su tamaño físico');
    expect(panel).toHaveTextContent('2,4 MB');
    expect(panel).toHaveTextContent('Carta 1 de 2');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Información de b.png' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('No la indica: se usan 72 ppp');
  });

  it('«Quitar todas» pide confirmación en una ventana de la app', async () => {
    const user = userEvent.setup();
    useCardsStore.getState().addImages([fakeImage('a.png'), fakeImage('b.png')]);
    render(
      <>
        <CardTray />
        <ConfirmHost />
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Quitar todas' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Quitar todas las cartas?' });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(useCardsStore.getState().cards).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Quitar todas' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Quitar todas' }),
    );
    expect(useCardsStore.getState().cards).toHaveLength(0);
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
    render(<CardsPage />, { wrapper: MemoryRouter });
    expect(screen.getByText(/no indican su resolución/)).toBeInTheDocument();

    await user.click(screen.getByText('Tamaño de la carta'));
    await user.click(screen.getByLabelText('Forzar ancho'));
    expect(screen.queryByText(/no indican su resolución/)).not.toBeInTheDocument();
  });

  it('no avisa de los ppp si se recorta, porque el recorte ya fija el tamaño', () => {
    useSettingsStore.getState().update({
      crop: { enabled: true, widthMm: 63, heightMm: 88, centered: true, x: 0, y: 0 },
    });
    useCardsStore.getState().addImages([fakeImage('a.png', null)]);
    render(<CardsPage />, { wrapper: MemoryRouter });
    expect(screen.queryByText(/no indican su resolución/)).not.toBeInTheDocument();
  });

  it('no avisa de los ppp con plantilla, porque cada hueco fija el tamaño', () => {
    useSettingsStore.getState().update({
      mode: 'template',
      template: {
        id: 't',
        name: 'x',
        pageMm: { width: 210, height: 297 },
        slots: [{ id: 's', xMm: 0, yMm: 0, widthMm: 63, heightMm: 88, rotation: 0 }],
      },
    });
    useCardsStore.getState().addImages([fakeImage('a.png', null)]);
    render(<CardsPage />, { wrapper: MemoryRouter });
    expect(screen.queryByText(/no indican su resolución/)).not.toBeInTheDocument();
  });

  it('muestra la plantilla del proyecto aunque no esté entre las guardadas', () => {
    useSettingsStore.getState().update({
      mode: 'template',
      template: {
        id: 'de-otro-equipo',
        name: 'Caja',
        pageMm: { width: 210, height: 297 },
        slots: [{ id: 's', xMm: 0, yMm: 0, widthMm: 63, heightMm: 88, rotation: 0 }],
      },
    });
    useTemplatesStore.setState({
      templates: [{ id: 'otra', name: 'Otra', pageMm: { width: 210, height: 297 }, slots: [] }],
    });
    render(<CardsPage />, { wrapper: MemoryRouter });
    expect(screen.getByRole('combobox', { name: 'Plantilla' })).toHaveDisplayValue(
      'Caja (del proyecto)',
    );
  });

  it('en modo plantilla sin plantilla, explica qué falta en vez de generar otra cosa', () => {
    useSettingsStore.getState().update({ mode: 'template', template: null });
    useCardsStore.getState().addImages([fakeImage('a.png')]);
    render(<CardsPage />, { wrapper: MemoryRouter });
    expect(screen.getByRole('alert')).toHaveTextContent('Elige en Distribución una plantilla');
  });

  it('calcula las páginas según la distribución', () => {
    useCardsStore.getState().addImages([fakeImage('a x10.png')]);
    render(<CardsPage />, { wrapper: MemoryRouter });
    expect(screen.getByText('2 páginas')).toBeInTheDocument();
  });
});
