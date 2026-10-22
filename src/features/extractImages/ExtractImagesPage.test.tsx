import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../../i18n';
import type { Analysis } from '../../pdf/extractImages';
import type { PageImage, RasterOptions } from '../../pdf/rasterize';
import type { ExtractedImage } from '../../pdf/renderExtracted';
import { useCardsStore, type NewImage } from '../../store/cardsStore';
import { TaskError, type AnalyzePdfImages } from '../../workers/pdfClient';
import { useSplitStore } from '../split/splitStore';
import { useExtractStore } from './extractStore';
import type { RenderThumbs } from './PagePicker';
import { ExtractImagesPage } from './ExtractImagesPage';

const analysis: Analysis = {
  images: [
    { order: 0, count: 9, width: 744, height: 1039, kind: 'jpeg', bytes: new Uint8Array(3) },
    { order: 1, count: 1, width: 600, height: 800, kind: 'render', renderPage: 0 },
  ],
  renderPdf: new Uint8Array(1),
  skipped: 2,
};

const extracted: ExtractedImage[] = [
  { name: 'juego_img_1 x9.jpg', blob: new Blob(['a']), width: 744, height: 1039, count: 9 },
  { name: 'juego_img_2.png', blob: new Blob(['b']), width: 600, height: 800, count: 1 },
];

const pageImages: PageImage[] = [1, 2, 3].map((n) => ({
  name: `juego_pag_${n}.jpg`,
  blob: new Blob([String(n)]),
  width: 2480,
  height: 3508,
}));

const inspect = async () => ({ pages: 4, thumbUrl: null, firstPage: { width: 595, height: 842 } });

/** Miniaturas al momento: «blob:pag-N» para cada una de las 4 páginas. */
const renderThumbs: RenderThumbs = async (_file, { onThumb }) => {
  for (let n = 1; n <= 4; n++) onThumb(n, `blob:pag-${n}`);
};

const toImages = async (images: ExtractedImage[]): Promise<NewImage[]> =>
  images.map((i) => ({
    name: i.name,
    path: i.name,
    blob: i.blob,
    format: 'png',
    widthPx: i.width,
    heightPx: i.height,
    dpi: null,
    thumbUrl: null,
  }));

function renderPage(props: Partial<Parameters<typeof ExtractImagesPage>[0]> = {}) {
  return render(
    <MemoryRouter initialEntries={['/extract-images']}>
      <Routes>
        <Route
          path="/extract-images"
          element={
            <ExtractImagesPage
              analyze={async () => analysis}
              renderImages={async () => extracted}
              inspect={inspect}
              rasterize={async () => pageImages}
              renderThumbs={renderThumbs}
              toImages={toImages}
              zip={async () => new Blob(['zip'])}
              {...props}
            />
          }
        />
        <Route path="/" element={<p>Pantalla de cartas</p>} />
        <Route path="/split" element={<p>Pantalla de dividir</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const pdf = new File(['%PDF'], 'juego.pdf', { type: 'application/pdf' });

beforeAll(() => i18n.changeLanguage('es'));
beforeEach(() => {
  useCardsStore.getState().reset();
  useSplitStore.getState().clear();
  useExtractStore.setState({ mode: 'images' });
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

describe('Extraer imágenes', () => {
  it('extrae, avisa de las pequeñas ignoradas y muestra cuántas veces aparece cada una', async () => {
    const user = userEvent.setup();
    const analyze = vi.fn<AnalyzePdfImages>(async () => analysis);
    renderPage({ analyze });
    await user.upload(screen.getByTestId('pdf-input'), pdf);
    await user.click(screen.getByRole('button', { name: 'Extraer imágenes' }));

    expect(await screen.findByText('2 imágenes encontradas')).toBeInTheDocument();
    expect(screen.getByText('Se han ignorado 2 imágenes pequeñas.')).toBeInTheDocument();
    expect(screen.getByText(/aparece 9 veces/)).toBeInTheDocument();
    expect(analyze.mock.calls[0][0].minSize).toBe(100);
  });

  it('sin «ignorar pequeñas» lo extrae todo', async () => {
    const user = userEvent.setup();
    const analyze = vi.fn<AnalyzePdfImages>(async () => analysis);
    renderPage({ analyze });
    await user.upload(screen.getByTestId('pdf-input'), pdf);
    await user.click(screen.getByLabelText(/Ignorar las imágenes de menos de 100 px/));
    await user.click(screen.getByRole('button', { name: 'Extraer imágenes' }));
    await screen.findByText('2 imágenes encontradas');
    expect(analyze.mock.calls[0][0].minSize).toBe(0);
  });

  it('se eligen las imágenes y solo esas van a Cartas, con las copias de « xN»', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.upload(screen.getByTestId('pdf-input'), pdf);
    await user.click(screen.getByRole('button', { name: 'Extraer imágenes' }));
    await user.click(await screen.findByLabelText('Incluir juego_img_2.png'));
    expect(screen.getByText('1 imagen elegida')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Añadir a Cartas' }));
    expect(await screen.findByText('Pantalla de cartas')).toBeInTheDocument();
    expect(useCardsStore.getState().cards.map((c) => [c.name, c.copies])).toEqual([
      ['juego_img_1 x9.jpg', 9],
    ]);
  });

  it('descarga en un ZIP las imágenes elegidas', async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const zip = vi.fn(async (_files: ExtractedImage[]) => new Blob(['zip']));
    renderPage({ zip });
    await user.upload(screen.getByTestId('pdf-input'), pdf);
    await user.click(screen.getByRole('button', { name: 'Extraer imágenes' }));
    await user.click(await screen.findByRole('button', { name: 'Desmarcar todas' }));
    expect(screen.getByRole('button', { name: 'Descargar ZIP' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Marcar todas' }));
    await user.click(screen.getByRole('button', { name: 'Descargar ZIP' }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(zip.mock.calls[0][0]).toHaveLength(2);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('juego imágenes.zip');
  });

  it('dice si el PDF no tiene imágenes', async () => {
    const user = userEvent.setup();
    renderPage({
      analyze: async () => ({ images: [], renderPdf: null, skipped: 0 }),
      renderImages: async () => [],
    });
    await user.upload(screen.getByTestId('pdf-input'), pdf);
    await user.click(screen.getByRole('button', { name: 'Extraer imágenes' }));
    expect(await screen.findByText('Este PDF no tiene imágenes que extraer.')).toBeInTheDocument();
  });

  it('explica si el PDF tiene contraseña', async () => {
    const user = userEvent.setup();
    renderPage({
      analyze: async () => {
        throw new TaskError('encrypted', 'x');
      },
    });
    await user.upload(screen.getByTestId('pdf-input'), pdf);
    await user.click(screen.getByRole('button', { name: 'Extraer imágenes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'juego.pdf está protegido con contraseña',
    );
  });

  describe('páginas completas', () => {
    async function openPages() {
      const user = userEvent.setup();
      const rasterize = vi.fn(async (_f: Blob, _n: string, _o: RasterOptions) => pageImages);
      renderPage({ rasterize });
      await user.upload(screen.getByTestId('pdf-input'), pdf);
      await screen.findByText('4 páginas');
      await user.click(screen.getByLabelText('Páginas completas'));
      return { user, rasterize };
    }

    it('enseña una miniatura de cada página, todas elegidas', async () => {
      await openPages();
      const picker = screen.getByRole('region', { name: 'Páginas del PDF' });
      expect([...picker.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toEqual([
        'blob:pag-1',
        'blob:pag-2',
        'blob:pag-3',
        'blob:pag-4',
      ]);
      expect(within(picker).getAllByRole('checkbox', { checked: true })).toHaveLength(4);
      expect(within(picker).getByText('4 de 4 elegidas')).toBeInTheDocument();
    });

    it('marcar y desmarcar miniaturas rellena el rango, y extrae esas páginas', async () => {
      const { user, rasterize } = await openPages();
      await user.click(screen.getByLabelText('Página 3'));
      expect(screen.getByLabelText('Páginas')).toHaveValue('1-2, 4');
      await user.click(screen.getByLabelText('Página 1'));
      expect(screen.getByLabelText('Páginas')).toHaveValue('2, 4');
      expect(screen.getByText('2 de 4 elegidas')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Extraer páginas' }));
      await screen.findByText('3 páginas extraídas');
      expect(rasterize.mock.calls[0][2].pages).toEqual([2, 4]);
    });

    it('escribir un rango marca sus miniaturas', async () => {
      const { user } = await openPages();
      await user.type(screen.getByLabelText('Páginas'), '2-3');
      expect(screen.getByLabelText('Página 1')).not.toBeChecked();
      expect(screen.getByLabelText('Página 2')).toBeChecked();
      expect(screen.getByLabelText('Página 3')).toBeChecked();
      expect(screen.getByLabelText('Página 4')).not.toBeChecked();
    });

    it('sin ninguna página elegida pide elegir y no deja extraer', async () => {
      const { user } = await openPages();
      const picker = screen.getByRole('region', { name: 'Páginas del PDF' });
      await user.click(within(picker).getByRole('button', { name: 'Desmarcar todas' }));
      expect(screen.getByText('Elige al menos una página.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Extraer páginas' })).toBeDisabled();

      await user.click(within(picker).getByRole('button', { name: 'Marcar todas' }));
      expect(screen.getByLabelText('Páginas')).toHaveValue('');
      expect(screen.getByRole('button', { name: 'Extraer páginas' })).toBeEnabled();
    });

    it('dibuja las páginas del rango con el formato y la resolución elegidos', async () => {
      const user = userEvent.setup();
      const rasterize = vi.fn(async (_f: Blob, _n: string, _o: RasterOptions) => pageImages);
      renderPage({ rasterize });
      await user.upload(screen.getByTestId('pdf-input'), pdf);
      expect(await screen.findByText('4 páginas')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Páginas completas'));
      expect(screen.queryByLabelText(/Ignorar las imágenes/)).not.toBeInTheDocument();
      // 595 × 842 pt a 300 ppp: 595 / 72 × 300 = 2479,2 → 2479; 842 / 72 × 300 = 3508,3 → 3508.
      expect(screen.getByText('La primera página saldrá de 2479 × 3508 px.')).toBeInTheDocument();
      await user.click(screen.getByLabelText(/PNG/));
      await user.click(screen.getByLabelText('600'));
      await user.type(screen.getByLabelText('Páginas'), '1-3');
      await user.click(screen.getByRole('button', { name: 'Extraer páginas' }));

      expect(await screen.findByText('3 páginas extraídas')).toBeInTheDocument();
      const [file, name, options] = rasterize.mock.calls[0];
      expect(file).toBe(pdf);
      expect(name).toBe('juego');
      expect(options).toMatchObject({ dpi: 600, format: 'png', pages: [1, 2, 3] });
      expect(screen.getAllByText('2480 × 3508 px')).toHaveLength(3);
      expect(screen.queryByText(/aparece/)).not.toBeInTheDocument();
    });

    it('no deja extraer con un rango no válido', async () => {
      const user = userEvent.setup();
      renderPage();
      await user.upload(screen.getByTestId('pdf-input'), pdf);
      await screen.findByText('4 páginas');
      await user.click(screen.getByLabelText('Páginas completas'));
      await user.type(screen.getByLabelText('Páginas'), '7');
      expect(screen.getByText(/Indica páginas entre 1 y 4/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Extraer páginas' })).toBeDisabled();
    });

    it('lleva las páginas elegidas a Cartas, una copia de cada una', async () => {
      const user = userEvent.setup();
      renderPage();
      await user.upload(screen.getByTestId('pdf-input'), pdf);
      await screen.findByText('4 páginas');
      await user.click(screen.getByLabelText('Páginas completas'));
      await user.click(screen.getByRole('button', { name: 'Extraer páginas' }));
      await user.click(await screen.findByLabelText('Incluir juego_pag_2.jpg'));
      expect(screen.getByText('2 páginas elegidas')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Añadir a Cartas' }));
      expect(await screen.findByText('Pantalla de cartas')).toBeInTheDocument();
      expect(useCardsStore.getState().cards.map((c) => [c.name, c.copies])).toEqual([
        ['juego_pag_1.jpg', 1],
        ['juego_pag_3.jpg', 1],
      ]);
    });

    it('o las lleva a Dividir imagen', async () => {
      const user = userEvent.setup();
      renderPage();
      await user.upload(screen.getByTestId('pdf-input'), pdf);
      await screen.findByText('4 páginas');
      await user.click(screen.getByLabelText('Páginas completas'));
      await user.click(screen.getByRole('button', { name: 'Extraer páginas' }));
      const footer = (await screen.findByText('3 páginas elegidas')).parentElement!;
      await user.click(within(footer).getByRole('button', { name: 'Dividir en cartas' }));

      expect(await screen.findByText('Pantalla de dividir')).toBeInTheDocument();
      expect(useSplitStore.getState().items.map((i) => i.image.name)).toEqual([
        'juego_pag_1.jpg',
        'juego_pag_2.jpg',
        'juego_pag_3.jpg',
      ]);
    });

    it('recuerda el modo elegido y al cambiarlo descarta el resultado anterior', async () => {
      const user = userEvent.setup();
      renderPage();
      await user.upload(screen.getByTestId('pdf-input'), pdf);
      await screen.findByText('4 páginas');
      await user.click(screen.getByRole('button', { name: 'Extraer imágenes' }));
      expect(await screen.findByText('2 imágenes encontradas')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Páginas completas'));
      expect(useExtractStore.getState().mode).toBe('pages');
      expect(screen.queryByText('2 imágenes encontradas')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Incluir juego_img_2.png')).not.toBeInTheDocument();
    });
  });
});
