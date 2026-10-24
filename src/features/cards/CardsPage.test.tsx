import { act, render, screen, within } from '@testing-library/react';
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
    render(<CardTray />, { wrapper: MemoryRouter });
    expect(screen.getByText(/Arrastra aquí las imágenes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imagen en blanco' })).toBeDisabled();
  });

  it('añade las imágenes elegidas y cuenta archivos y cartas', async () => {
    const user = userEvent.setup();
    const loadImages = vi.fn(async (entries: { path: string }[]) => ({
      images: entries.map((e) => fakeImage(e.path)),
      failed: [],
    }));
    render(<CardTray loadImages={loadImages} />, { wrapper: MemoryRouter });

    await user.upload(screen.getByTestId('file-input'), [file('a.png'), file('b x3.png')]);

    expect(await screen.findByText('2 archivos / 4 cartas')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('cambia las copias, añade una imagen en blanco y quita cartas', async () => {
    const user = userEvent.setup();
    useCardsStore.getState().addImages([fakeImage('a.png')]);
    render(<CardTray />, { wrapper: MemoryRouter });

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
    render(<CardTray />, { wrapper: MemoryRouter });

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
    render(<CardTray />, { wrapper: MemoryRouter });

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

  describe('colocación de la información', () => {
    const innerHeight = window.innerHeight;
    // Botón cerca del borde inferior de una ventana de 600 px; el panel mide lo que diga `panelHeight`.
    function mockRects(panelHeight: number) {
      window.innerHeight = 600;
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: Element,
      ) {
        const isPanel = this.getAttribute('role') === 'dialog';
        const top = isPanel ? 0 : 540;
        const height = isPanel ? panelHeight : 24;
        return {
          top,
          bottom: top + height,
          height,
          left: 476,
          right: 500,
          width: 24,
          x: 476,
          y: top,
          toJSON: () => ({}),
        } as DOMRect;
      });
    }
    afterEach(() => {
      vi.restoreAllMocks();
      window.innerHeight = innerHeight;
    });

    it('se abre hacia arriba cuando no cabe debajo del botón', async () => {
      const user = userEvent.setup();
      useCardsStore.getState().addImages([fakeImage('a.png')]);
      render(<CardTray />, { wrapper: MemoryRouter });
      mockRects(300);

      await user.click(screen.getByRole('button', { name: 'Información de a.png' }));
      // Encima del botón: 540 − 4 − 300.
      expect(screen.getByRole('dialog')).toHaveStyle({ top: '236px' });
    });

    it('si no cabe en ningún lado, usa el lado con más hueco y se desplaza dentro', async () => {
      const user = userEvent.setup();
      useCardsStore.getState().addImages([fakeImage('a.png')]);
      render(<CardTray />, { wrapper: MemoryRouter });
      mockRects(800);

      await user.click(screen.getByRole('button', { name: 'Información de a.png' }));
      // Arriba hay 540 − 4 − 16 = 520 px; abajo solo 600 − 16 − 568 = 16.
      expect(screen.getByRole('dialog')).toHaveStyle({ top: '16px', maxHeight: '520px' });
    });
  });

  it('«Quitar todas» pide confirmación en una ventana de la app', async () => {
    const user = userEvent.setup();
    useCardsStore.getState().addImages([fakeImage('a.png'), fakeImage('b.png')]);
    render(
      <>
        <CardTray />
        <ConfirmHost />
      </>,
      { wrapper: MemoryRouter },
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
    render(<CardTray loadImages={loadImages} />, { wrapper: MemoryRouter });
    await user.upload(screen.getByTestId('file-input'), [file('roto.png')]);
    expect(await screen.findByRole('alert')).toHaveTextContent('roto.png');
  });
});

describe('SettingsPanel', () => {
  it('muestra columnas y filas solo en modo manual', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />, { wrapper: MemoryRouter });
    expect(screen.queryByLabelText('Columnas')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Manual'));
    expect(screen.getByLabelText('Columnas')).toHaveValue('3');
  });

  it('guarda el margen escrito con coma decimal', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />, { wrapper: MemoryRouter });
    const margin = screen.getByLabelText('Margen de la página');
    await user.clear(margin);
    await user.type(margin, '5,5');
    expect(useSettingsStore.getState().settings.marginMm).toBe(5.5);
  });

  it('activa el giro de las cartas horizontales desde Tamaño de la carta', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />, { wrapper: MemoryRouter });
    await user.click(screen.getByText('Tamaño de la carta'));
    await user.click(screen.getByLabelText(/Girar las cartas horizontales/));
    expect(useSettingsStore.getState().settings.autoRotate).toBe(true);
  });

  it('sin cartas, la pista del tamaño según la imagen es la genérica', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />, { wrapper: MemoryRouter });
    await user.click(screen.getByText('Tamaño de la carta'));
    expect(screen.getByText(/Si no fuerzas el tamaño/)).toBeInTheDocument();
  });

  it('con cartas, muestra el tamaño de la primera y cuántas miden distinto', async () => {
    const user = userEvent.setup();
    // 744 × 1039 px a 300 ppp: 63,0 × 88,0 mm. A 150 ppp mide el doble.
    useCardsStore
      .getState()
      .addImages([fakeImage('a.png'), fakeImage('b.png', { x: 150, y: 150 }), fakeImage('c.png')]);
    render(<SettingsPanel />, { wrapper: MemoryRouter });
    await user.click(screen.getByText('Tamaño de la carta'));
    expect(
      screen.getByText('Según la resolución de la imagen: 63,0 × 88,0 mm'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 carta tiene otro tamaño')).toBeInTheDocument();
    expect(screen.queryByText(/Si no fuerzas el tamaño/)).not.toBeInTheDocument();
  });

  it('con recorte activo dice que el tamaño es el del recorte', async () => {
    const user = userEvent.setup();
    useCardsStore
      .getState()
      .addImages([fakeImage('a.png'), fakeImage('b.png', { x: 150, y: 150 })]);
    // 60 mm → 709 px → 60,0 mm; 85 mm → 1004 px → 85,0 mm. Recortadas, todas miden igual.
    useSettingsStore
      .getState()
      .update({ crop: { enabled: true, widthMm: 60, heightMm: 85, centered: true, x: 0, y: 0 } });
    render(<SettingsPanel />, { wrapper: MemoryRouter });
    await user.click(screen.getByText('Tamaño de la carta'));
    expect(screen.getByText('Con el recorte: 60,0 × 85,0 mm')).toBeInTheDocument();
    expect(screen.queryByText(/otro tamaño/)).not.toBeInTheDocument();
  });

  it('si todas miden igual no avisa, y con un tamaño elegido no muestra nada', async () => {
    const user = userEvent.setup();
    useCardsStore.getState().addImages([fakeImage('a.png'), fakeImage('b.png')]);
    render(<SettingsPanel />, { wrapper: MemoryRouter });
    await user.click(screen.getByText('Tamaño de la carta'));
    expect(screen.getByText(/Según la resolución de la imagen: 63,0/)).toBeInTheDocument();
    expect(screen.queryByText(/otro tamaño/)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Tamaño'), 'poker');
    expect(screen.queryByText(/Según la resolución de la imagen:/)).not.toBeInTheDocument();
  });

  it('elegir un tamaño predefinido fuerza ancho y alto', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />, { wrapper: MemoryRouter });
    await user.click(screen.getByText('Tamaño de la carta'));
    const size = screen.getByLabelText('Tamaño');
    expect(size).toHaveValue('image');
    await user.selectOptions(size, 'tarot');
    expect(useSettingsStore.getState().settings).toMatchObject({
      forceWidth: true,
      forceHeight: true,
      cardWidthMm: 70,
      cardHeightMm: 120,
    });
    expect(screen.getByRole('option', { name: 'Tarot (70 × 120 mm)' })).toBeInTheDocument();
  });

  it('al cambiar las medidas de un tamaño pasa a personalizado', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />, { wrapper: MemoryRouter });
    await user.click(screen.getByText('Tamaño de la carta'));
    await user.selectOptions(screen.getByLabelText('Tamaño'), 'poker');
    const width = screen.getByLabelText('Ancho');
    await user.clear(width);
    await user.type(width, '64');
    expect(screen.getByLabelText('Tamaño')).toHaveValue('custom');
    expect(screen.getByLabelText('Forzar ancho')).toBeChecked();
  });

  it('personalizado sin medidas parte de póker y vuelve a la resolución', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />, { wrapper: MemoryRouter });
    await user.click(screen.getByText('Tamaño de la carta'));
    const size = screen.getByLabelText('Tamaño');
    await user.selectOptions(size, 'custom');
    expect(size).toHaveValue('custom');
    expect(screen.getByLabelText('Ancho')).toHaveValue('63');
    await user.selectOptions(size, 'image');
    expect(useSettingsStore.getState().settings).toMatchObject({
      forceWidth: false,
      forceHeight: false,
    });
  });
});

describe('CardsPage', () => {
  it('avisa de imágenes sin ppp hasta que se fuerza el tamaño', async () => {
    const user = userEvent.setup();
    useCardsStore.getState().addImages([fakeImage('a.png', null)]);
    render(<CardsPage />, { wrapper: MemoryRouter });
    expect(screen.getByText(/no indican su resolución/)).toBeInTheDocument();

    await user.click(screen.getByText('Tamaño de la carta'));
    await user.selectOptions(screen.getByLabelText('Tamaño'), 'poker');
    expect(screen.queryByText(/no indican su resolución/)).not.toBeInTheDocument();
  });

  it('avisa de las cartas que saldrán con poca resolución al forzar el tamaño', async () => {
    const user = userEvent.setup();
    useCardsStore
      .getState()
      .addImages([
        fakeImage('grande.png'),
        { ...fakeImage('pequeña.png'), widthPx: 400, heightPx: 560 },
        { ...fakeImage('sin-ppp.png', null), widthPx: 300, heightPx: 420 },
      ]);
    render(<CardsPage />, { wrapper: MemoryRouter });
    // Sin fijar el tamaño, cada una sale a sus ppp: solo avisa la de 300 px a 72 ppp, con «?».
    expect(screen.queryByText(/poca resolución/)).not.toBeInTheDocument();
    expect(screen.getByText('? ppp')).toBeInTheDocument();
    expect(screen.getAllByText('300 ppp')).toHaveLength(2);

    await user.click(screen.getByText('Tamaño de la carta'));
    await user.selectOptions(screen.getByLabelText('Tamaño'), 'poker');
    // 400 / (63 / 25,4) = 161; 300 / (63 / 25,4) = 121.
    expect(screen.getByText('2 cartas saldrán con poca resolución').closest('p')).toHaveTextContent(
      '(menos de 300 ppp al tamaño de impresión)',
    );
    expect(screen.getByText('161 ppp al imprimir')).toBeInTheDocument();
    expect(screen.getByText('121 ppp al imprimir')).toBeInTheDocument();
    expect(screen.getByText('300 ppp')).toBeInTheDocument();
    expect(screen.queryByText('? ppp')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Información de pequeña.png' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('161 ppp, poca resolución');
  });

  it('una imagen de pocos ppp avisa también a su tamaño natural', () => {
    useCardsStore.getState().addImages([fakeImage('web.png', { x: 150, y: 150 })]);
    render(<CardsPage />, { wrapper: MemoryRouter });
    expect(screen.getByText('1 carta saldrá con poca resolución')).toBeInTheDocument();
    expect(screen.getByText('150 ppp al imprimir')).toBeInTheDocument();
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

describe('giro de la carta', () => {
  const landscape = { ...fakeImage('mapa.png'), widthPx: 1039, heightPx: 744 };

  it('se gira desde su información y la tarjeta lo indica', async () => {
    const user = userEvent.setup();
    useCardsStore.getState().addImages([fakeImage('a.png'), landscape]);
    render(<CardTray />, { wrapper: MemoryRouter });

    await user.click(screen.getByRole('button', { name: 'Información de mapa.png' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Giro').nextSibling).toHaveTextContent('Ninguno');
    await user.click(within(dialog).getByRole('button', { name: 'Girar 90° a la derecha' }));
    expect(useCardsStore.getState().cards[1].rotation).toBe(270);
    expect(within(dialog).getByText('Giro').nextSibling).toHaveTextContent('90° a la derecha');
    await user.click(within(dialog).getByRole('button', { name: 'Girar 90° a la izquierda' }));
    expect(useCardsStore.getState().cards[1].rotation).toBeUndefined();
    await user.keyboard('{Escape}');

    act(() => useCardsStore.getState().setRotation(useCardsStore.getState().cards[1].id, 90));
    expect(screen.getByText('Girada 90° a la izquierda')).toBeInTheDocument();
  });

  it('con el giro automático, la información dice que la carta horizontal se gira sola', async () => {
    const user = userEvent.setup();
    useSettingsStore.getState().update({ autoRotate: true });
    useCardsStore.getState().addImages([fakeImage('a.png'), landscape]);
    render(<CardTray />, { wrapper: MemoryRouter });
    expect(screen.getByText('Girada 90° a la derecha')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Información de mapa.png' }));
    expect(screen.getByText('Giro').nextSibling).toHaveTextContent('90° a la derecha, automático');
  });
});
