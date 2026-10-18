import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../../i18n';
import type { PageImage, RasterOptions } from '../../pdf/rasterize';
import { useCardsStore, type NewImage } from '../../store/cardsStore';
import { useSplitStore } from '../split/splitStore';
import { PdfToImagesPage } from './PdfToImagesPage';

const inspect = async () => ({ pages: 4, thumbUrl: null, firstPage: { width: 595, height: 842 } });
const toImages = async (pages: PageImage[]): Promise<NewImage[]> =>
  pages.map((p) => ({
    name: p.name,
    path: p.name,
    blob: p.blob,
    format: 'jpeg',
    widthPx: 2479,
    heightPx: 3508,
    dpi: { x: 300, y: 300 },
    thumbUrl: null,
  }));

function controllableRasterize() {
  let opts!: RasterOptions;
  let finish!: (pages: PageImage[]) => void;
  const rasterize = vi.fn((_file: Blob, _name: string, options: RasterOptions) => {
    opts = options;
    return new Promise<PageImage[]>((resolve, reject) => {
      finish = resolve;
      options.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError')));
    });
  });
  return {
    rasterize,
    progress: (done: number, total: number) => act(() => opts.onProgress?.(done, total)),
    finish: (n: number) =>
      act(async () =>
        finish(
          Array.from({ length: n }, (_, i) => ({
            name: `reglas_pag_${i + 1}.jpg`,
            blob: new Blob([new Uint8Array(1000)]),
          })),
        ),
      ),
  };
}

function renderPage(props: Partial<Parameters<typeof PdfToImagesPage>[0]> = {}) {
  return render(
    <MemoryRouter initialEntries={['/pdf-to-images']}>
      <Routes>
        <Route
          path="/pdf-to-images"
          element={<PdfToImagesPage inspect={inspect} toImages={toImages} {...props} />}
        />
        <Route path="/" element={<p>Pantalla de cartas</p>} />
        <Route path="/split" element={<p>Pantalla de dividir</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const pdf = new File(['%PDF'], 'reglas.pdf', { type: 'application/pdf' });

beforeAll(() => i18n.changeLanguage('es'));
beforeEach(() => {
  useCardsStore.getState().reset();
  useSplitStore.getState().clear();
  URL.createObjectURL = vi.fn(() => 'blob:zip');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

describe('PDF a imágenes', () => {
  it('muestra el PDF elegido y el tamaño en píxeles según la resolución', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.upload(screen.getByTestId('pdf-input'), pdf);

    expect(await screen.findByText('4 páginas')).toBeInTheDocument();
    expect(screen.getByText('La primera página saldrá de 2479 × 3508 px.')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '150' }));
    expect(screen.getByText('La primera página saldrá de 1240 × 1754 px.')).toBeInTheDocument();
  });

  it('valida el rango de páginas', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.upload(screen.getByTestId('pdf-input'), pdf);
    const range = await screen.findByLabelText('Páginas');

    await user.type(range, '2-9');
    expect(screen.getByText(/Indica páginas entre 1 y 4/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Convertir/ })).toBeDisabled();

    await user.clear(range);
    await user.type(range, '1, 3-4');
    expect(screen.getByRole('button', { name: 'Convertir 3 páginas' })).toBeEnabled();
  });

  it('convierte con el formato y la resolución elegidos y descarga el ZIP', async () => {
    const user = userEvent.setup();
    const r = controllableRasterize();
    const zip = vi.fn(async () => new Blob([new Uint8Array(4000)]));
    renderPage({ rasterize: r.rasterize, zip });
    await user.upload(screen.getByTestId('pdf-input'), pdf);
    await user.click(await screen.findByRole('radio', { name: 'PNG sin pérdida, máxima calidad' }));
    await user.click(screen.getByRole('radio', { name: '600' }));
    await user.click(screen.getByRole('button', { name: 'Convertir 4 páginas' }));

    expect(r.rasterize.mock.calls[0][2]).toMatchObject({
      dpi: 600,
      format: 'png',
      pages: [1, 2, 3, 4],
    });
    r.progress(1, 4);
    expect(screen.getByText('Convirtiendo: 1 de 4 páginas')).toBeInTheDocument();

    await r.finish(4);
    expect(zip).toHaveBeenCalled();
    const anchor = vi.mocked(HTMLAnchorElement.prototype.click).mock
      .contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('reglas páginas.zip');
    expect(screen.getByText('4 imágenes en 4 kB.')).toBeInTheDocument();
  });

  it('pasa las páginas convertidas a Cartas', async () => {
    const user = userEvent.setup();
    const r = controllableRasterize();
    renderPage({ rasterize: r.rasterize, zip: async () => new Blob(['z']) });
    await user.upload(screen.getByTestId('pdf-input'), pdf);
    await user.click(await screen.findByRole('button', { name: 'Convertir 4 páginas' }));
    await r.finish(2);
    await user.click(screen.getByRole('button', { name: 'Añadir a Cartas' }));

    expect(await screen.findByText('Pantalla de cartas')).toBeInTheDocument();
    expect(useCardsStore.getState().cards.map((c) => c.name)).toEqual([
      'reglas_pag_1.jpg',
      'reglas_pag_2.jpg',
    ]);
  });

  it('o las lleva a Dividir', async () => {
    const user = userEvent.setup();
    const r = controllableRasterize();
    renderPage({ rasterize: r.rasterize, zip: async () => new Blob(['z']) });
    await user.upload(screen.getByTestId('pdf-input'), pdf);
    await user.click(await screen.findByRole('button', { name: 'Convertir 4 páginas' }));
    await r.finish(1);
    await user.click(screen.getByRole('button', { name: 'Llevar a Dividir' }));

    expect(await screen.findByText('Pantalla de dividir')).toBeInTheDocument();
    expect(useSplitStore.getState().items.map((i) => i.image.name)).toEqual(['reglas_pag_1.jpg']);
  });

  it('avisa si el archivo no es un PDF', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPage();
    await user.upload(
      screen.getByTestId('pdf-input'),
      new File(['x'], 'foto.png', { type: 'image/png' }),
    );
    expect(await screen.findByText('foto.png no es un PDF.')).toBeInTheDocument();
  });
});
