import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../../i18n';
import type { FolderFile } from '../../lib/imageMatch';
import { useCardsStore, type NewImage } from '../../store/cardsStore';
import type { SplitImages, TaskOptions } from '../../workers/pdfClient';
import { SplitPage } from './SplitPage';
import { useSplitStore } from './splitStore';

const image = (name: string, widthPx = 900, heightPx = 1200): NewImage => ({
  name,
  path: name,
  blob: new Blob(['x'], { type: 'image/png' }),
  format: 'png',
  widthPx,
  heightPx,
  dpi: { x: 300, y: 300 },
  thumbUrl: null,
});

const loadImages = async (entries: FolderFile[]) => ({
  images: entries.map((e) => image(e.file.name)),
  failed: [],
});

function renderPage(props: Partial<Parameters<typeof SplitPage>[0]> = {}) {
  return render(
    <MemoryRouter initialEntries={['/split']}>
      <Routes>
        <Route path="/split" element={<SplitPage loadImages={loadImages} {...props} />} />
        <Route path="/" element={<p>Pantalla de cartas</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const upload = (user: ReturnType<typeof userEvent.setup>, ...names: string[]) =>
  user.upload(
    screen.getByTestId('split-input'),
    names.map((n) => new File(['x'], n, { type: 'image/png' })),
  );

beforeAll(() => i18n.changeLanguage('es'));
beforeEach(() => {
  useSplitStore.getState().clear();
  useSplitStore.getState().setSameForAll(true);
  useCardsStore.getState().reset();
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

describe('Dividir imagen', () => {
  it('empieza con la imagen entera en 3 × 3 y dice cuánto mide cada parte', async () => {
    const user = userEvent.setup();
    renderPage();
    await upload(user, 'hoja.png');
    expect(await screen.findByText('Imagen: 900 × 1200 px, a 300 ppp')).toBeInTheDocument();
    expect(screen.getByText('Cada parte: 300 × 400 px (25,4 × 33,9 mm)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dividir en 9 partes' })).toBeEnabled();
  });

  it('avisa cuando las partes no salen exactas', async () => {
    const user = userEvent.setup();
    renderPage();
    await upload(user, 'hoja.png');
    const columns = await screen.findByLabelText('Columnas');
    await user.clear(columns);
    // 900 / 7 = 128,57: unas partes miden 128 px y otras 129.
    await user.type(columns, '7');
    expect(screen.getByText(/unos 128 × 400 px/)).toBeInTheDocument();
    expect(screen.getByText(/el sobrante se reparte/)).toBeInTheDocument();
  });

  it('«Quitar el margen» ajusta la zona al contenido', async () => {
    const user = userEvent.setup();
    const contentOf = vi.fn(async () => ({ x: 30, y: 40, width: 840, height: 1100 }));
    renderPage({ contentOf });
    await upload(user, 'hoja.png');
    await user.click(await screen.findByRole('button', { name: 'Quitar el margen' }));
    expect(screen.getByLabelText('X')).toHaveValue('30');
    expect(screen.getByLabelText('Ancho')).toHaveValue('840');
  });

  it('las flechas mueven la zona', async () => {
    const user = userEvent.setup();
    renderPage();
    await upload(user, 'hoja.png');
    const width = await screen.findByLabelText('Ancho');
    await user.clear(width);
    await user.type(width, '800');
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Zona a dividir' }), {
      key: 'ArrowRight',
      shiftKey: true,
    });
    expect(screen.getByLabelText('X')).toHaveValue('10');
  });

  it('divide todas las imágenes con sus ajustes y luego las pasa a Cartas', async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    let options: TaskOptions = {};
    let finish!: (zip: Uint8Array) => void;
    const split = vi.fn<SplitImages>((_input, opts) => {
      options = opts ?? {};
      return new Promise((resolve) => (finish = resolve));
    });
    const toCards = vi.fn(async () => [image('hoja_img_1.png'), image('hoja_img_2.png')]);
    renderPage({ split, toCards });

    await upload(user, 'hoja.png', 'otra.png');
    const rows = await screen.findByLabelText('Filas');
    await user.clear(rows);
    await user.type(rows, '1');
    await user.click(screen.getByRole('button', { name: 'Dividir en 6 partes' }));

    const [input] = split.mock.calls[0];
    expect(input.map((j) => [j.name, j.columns, j.rows, j.dpi])).toEqual([
      ['hoja.png', 3, 1, 300],
      ['otra.png', 3, 1, 300],
    ]);
    act(() => options.onProgress?.(2, 6));
    expect(screen.getByText('Dividiendo: 2 de 6 partes')).toBeInTheDocument();

    await act(async () => finish(new Uint8Array(2048)));
    expect(screen.getByText('6 partes en 2 kB.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Añadir a Cartas' }));
    expect(await screen.findByText('Pantalla de cartas')).toBeInTheDocument();
    expect(useCardsStore.getState().cards.map((c) => c.name)).toEqual([
      'hoja_img_1.png',
      'hoja_img_2.png',
    ]);
  });

  it('sin «mismos ajustes», cada imagen se divide a su manera', async () => {
    const user = userEvent.setup();
    renderPage();
    await upload(user, 'a.png', 'b.png');
    await user.click(await screen.findByLabelText('Mismos ajustes para todas las imágenes'));
    const columns = screen.getByLabelText('Columnas');
    await user.clear(columns);
    await user.type(columns, '2');
    expect(screen.getByRole('button', { name: 'Dividir en 15 partes' })).toBeInTheDocument();
  });
});
