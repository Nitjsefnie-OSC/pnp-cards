import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../../i18n';
import type { Analysis } from '../../pdf/extractImages';
import type { ExtractedImage } from '../../pdf/renderExtracted';
import { useCardsStore, type NewImage } from '../../store/cardsStore';
import { TaskError, type AnalyzePdfImages } from '../../workers/pdfClient';
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
              toImages={toImages}
              zip={async () => new Blob(['zip'])}
              {...props}
            />
          }
        />
        <Route path="/" element={<p>Pantalla de cartas</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const pdf = new File(['%PDF'], 'juego.pdf', { type: 'application/pdf' });

beforeAll(() => i18n.changeLanguage('es'));
beforeEach(() => {
  useCardsStore.getState().reset();
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
});
