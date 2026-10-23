import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n';
import { useCardsStore, type NewImage } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';
import type { GeneratePdf } from '../../workers/pdfClient';
import { CardTray } from './CardTray';
import { PagePreview } from './PagePreview';
import { PrintPanel } from './PrintPanel';

vi.mock('./loadImages', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  loadImage: async (file: File, path = file.name): Promise<NewImage> => ({
    name: file.name,
    path,
    blob: file,
    format: 'png',
    widthPx: 744,
    heightPx: 1039,
    dpi: { x: 300, y: 300 },
    thumbUrl: 'blob:thumb',
  }),
}));

const found = (name: string, copies: number) => ({
  name,
  path: name,
  blob: new Blob(['x'], { type: 'image/png' }),
  format: 'png' as const,
  widthPx: 744,
  heightPx: 1039,
  dpi: { x: 300, y: 300 },
  thumbUrl: `blob:${name}`,
  copies,
});

const missing = (path: string, copies: number) => ({
  name: path.split('/').pop()!,
  path,
  blob: null,
  format: 'png' as const,
  widthPx: 0,
  heightPx: 0,
  dpi: null,
  thumbUrl: null,
  missing: true,
  copies,
});

beforeAll(() => i18n.changeLanguage('es'));
beforeEach(() => {
  useSettingsStore.getState().reset();
  useSettingsStore.getState().setOpenAfter(false);
  useCardsStore.getState().load('x', [found('a.png', 7), missing('heroes/elfo.png', 3)], null);
  URL.createObjectURL = vi.fn(() => 'blob:pdf');
  URL.revokeObjectURL = vi.fn();
});

describe('cartas que faltan', () => {
  it('se ven en la bandeja con un aviso de que no se imprimirán', () => {
    render(<CardTray />, { wrapper: MemoryRouter });
    expect(screen.getByText('No se encuentra')).toBeInTheDocument();
    expect(screen.getByText(/1 imagen no se encuentra y no se imprimirá/)).toBeInTheDocument();
  });

  it('no salen en la vista previa, ni como hueco en blanco', () => {
    const { container } = render(<PagePreview />);
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
    expect(container.querySelectorAll('image')).toHaveLength(7);
  });

  it('no se mandan a generar el PDF', async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const generate = vi.fn<GeneratePdf>(async () => new Uint8Array(10));
    render(<PrintPanel generatePdf={generate} />);
    expect(screen.getByText('1 página')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generar PDF' }));
    expect(generate.mock.calls[0][0].cards.map((c) => c.copies)).toEqual([7]);
  });

  it('al buscar su imagen, la carta vuelve con sus copias', async () => {
    const user = userEvent.setup();
    render(<CardTray />, { wrapper: MemoryRouter });
    await user.upload(
      screen.getByLabelText('Buscar imagen de elfo.png'),
      new File(['x'], 'elfo.png', { type: 'image/png' }),
    );
    await waitFor(() => expect(useCardsStore.getState().cards[1].missing).toBe(false));
    expect(useCardsStore.getState().cards[1]).toMatchObject({ path: 'heroes/elfo.png', copies: 3 });
    expect(screen.queryByText('No se encuentra')).not.toBeInTheDocument();
  });
});
