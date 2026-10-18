import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';
import { DEFAULT_SETTINGS } from '../../lib/settings';
import { useCardsStore, type NewImage } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { CropDialog } from './CropDialog';
import { PagePreview } from './PagePreview';

const image = (name: string, over: Partial<NewImage> = {}): NewImage => ({
  name,
  path: name,
  blob: new Blob(['x'], { type: 'image/png' }),
  format: 'png',
  widthPx: 822,
  heightPx: 1122,
  dpi: { x: 300, y: 300 },
  thumbUrl: `blob:${name}`,
  ...over,
});

const images = (container: HTMLElement) => container.querySelectorAll('image');

beforeAll(() => i18n.changeLanguage('es'));
beforeEach(() => {
  useCardsStore.getState().clear();
  useSettingsStore.getState().reset();
  URL.createObjectURL = vi.fn(() => 'blob:full');
  URL.revokeObjectURL = vi.fn();
});

describe('PagePreview', () => {
  it('invita a añadir cartas cuando no hay ninguna', () => {
    render(<PagePreview />);
    expect(screen.getByText(/Añade cartas para ver/)).toBeInTheDocument();
  });

  it('muestra cada página con sus cartas y deja pasar de una a otra', async () => {
    const user = userEvent.setup();
    useCardsStore.getState().addImages([image('a x10.png')]);
    const { container } = render(<PagePreview />);

    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    expect(images(container)).toHaveLength(9);
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    expect(images(container)).toHaveLength(1);
  });

  it('dibuja las líneas de corte si están activadas', () => {
    useSettingsStore.getState().update({
      cutLines: { ...DEFAULT_SETTINGS.cutLines, enabled: true, style: 'full' },
    });
    useCardsStore.getState().addImages([image('a.png')]);
    const { container } = render(<PagePreview />);
    expect(container.querySelectorAll('line')).toHaveLength(12);
  });

  it('muestra solo la parte recortada de cada imagen', () => {
    useSettingsStore.getState().update({
      crop: { enabled: true, widthMm: 63, heightMm: 88, centered: true, x: 0, y: 0 },
    });
    useCardsStore.getState().addImages([image('a.png')]);
    const { container } = render(<PagePreview />);
    expect(images(container)[0].parentElement).toHaveAttribute('viewBox', '39 42 744 1039');
  });

  it('explica el problema si solo hay imágenes en blanco', () => {
    useCardsStore.getState().addBlank();
    render(<PagePreview />);
    expect(screen.getByRole('alert')).toHaveTextContent('fuerza el ancho y el alto');
  });
});

describe('CropDialog', () => {
  function openWithCrop() {
    useSettingsStore.getState().update({
      crop: { enabled: true, widthMm: 63, heightMm: 88, centered: true, x: 0, y: 0 },
    });
    useCardsStore.getState().addImages([image('a.png')]);
    render(<CropDialog open onClose={() => {}} />);
  }

  it('muestra el tamaño de la imagen y del recorte en píxeles', () => {
    openWithCrop();
    expect(
      screen.getByText('Imagen: 822 × 1122 px (69,6 × 95,0 mm a 300 ppp)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Recorte: 744 × 1039 px')).toBeInTheDocument();
  });

  it('con el recorte centrado, X e Y muestran la posición calculada y no se editan', () => {
    openWithCrop();
    expect(screen.getByLabelText('X')).toHaveValue('39');
    expect(screen.getByLabelText('X')).toBeDisabled();
  });

  it('mover el recorte con las flechas deja de centrarlo', () => {
    openWithCrop();
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Zona recortada' }), {
      key: 'ArrowRight',
      shiftKey: true,
    });
    expect(useSettingsStore.getState().settings.crop).toMatchObject({
      centered: false,
      x: 49,
      y: 42,
    });
  });

  it('avisa si el recorte no cabe en la imagen', async () => {
    const user = userEvent.setup();
    openWithCrop();
    const width = screen.getByLabelText('Ancho');
    await user.clear(width);
    await user.type(width, '100');
    expect(screen.getByText(/no cabe en esta imagen/)).toBeInTheDocument();
  });
});
