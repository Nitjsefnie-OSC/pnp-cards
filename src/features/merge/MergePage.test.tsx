import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';
import { UnreadablePdfError, type PdfInfo } from '../../pdf/pdfjs';
import { TaskError, type MergePdfs, type TaskOptions } from '../../workers/pdfClient';
import { MergePage } from './MergePage';

const pdf = (name: string) => new File(['%PDF-1.7'], name, { type: 'application/pdf' });

/** Páginas por nombre de archivo; «roto.pdf» no se puede leer. */
const inspect = async (file: Blob): Promise<PdfInfo> => {
  const name = (file as File).name;
  if (name === 'roto.pdf') throw new UnreadablePdfError();
  return { pages: name.length, thumbUrl: null };
};

function controllableMerge() {
  let options: TaskOptions = {};
  let resolve!: (pdf: Uint8Array) => void;
  let reject!: (err: unknown) => void;
  const merge = vi.fn<MergePdfs>((_input, opts) => {
    options = opts ?? {};
    return new Promise((res, rej) => {
      resolve = res;
      reject = rej;
      options.signal?.addEventListener('abort', () => rej(new DOMException('x', 'AbortError')));
    });
  });
  return {
    merge,
    progress: (done: number, total: number) => act(() => options.onProgress?.(done, total)),
    finish: () => act(async () => resolve(new Uint8Array(1_500_000))),
    fail: (err: unknown) => act(async () => reject(err)),
  };
}

beforeAll(() => i18n.changeLanguage('es'));
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:merged');
  URL.revokeObjectURL = vi.fn();
});

describe('Unir PDF', () => {
  it('lista los PDF añadidos con sus páginas y el total', async () => {
    const user = userEvent.setup();
    render(<MergePage inspect={inspect} />);
    await user.upload(screen.getByTestId('pdf-input'), [pdf('a.pdf'), pdf('bb.pdf')]);

    expect(await screen.findByText('5 páginas, 0 kB')).toBeInTheDocument();
    expect(screen.getByText('6 páginas, 0 kB')).toBeInTheDocument();
    expect(screen.getByText('En total, 11 páginas')).toBeInTheDocument();
  });

  it('no deja unir con menos de dos PDF', async () => {
    const user = userEvent.setup();
    render(<MergePage inspect={inspect} />);
    await user.upload(screen.getByTestId('pdf-input'), [pdf('a.pdf')]);
    expect(await screen.findByText('Añade al menos dos PDF para unirlos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unir PDF' })).toBeDisabled();
  });

  it('avisa de los archivos que no son PDF', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<MergePage inspect={inspect} />);
    await user.upload(screen.getByTestId('pdf-input'), [
      new File(['x'], 'foto.png', { type: 'image/png' }),
    ]);
    expect(
      await screen.findByText('foto.png no es un PDF y no se ha añadido.'),
    ).toBeInTheDocument();
  });

  it('marca los PDF que no se pueden leer y no deja unirlos', async () => {
    const user = userEvent.setup();
    render(<MergePage inspect={inspect} />);
    await user.upload(screen.getByTestId('pdf-input'), [pdf('a.pdf'), pdf('roto.pdf')]);
    expect(await screen.findByText(/está dañado o protegido con contraseña/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unir PDF' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Quitar roto.pdf' }));
    expect(screen.queryByText(/está dañado/)).not.toBeInTheDocument();
  });

  it('une los PDF en el orden de la lista y descarga el resultado', async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const m = controllableMerge();
    render(<MergePage inspect={inspect} merge={m.merge} />);
    await user.upload(screen.getByTestId('pdf-input'), [pdf('b.pdf'), pdf('a.pdf')]);
    await screen.findByText('En total, 10 páginas');

    await user.click(screen.getByRole('button', { name: 'Unir PDF' }));
    expect(m.merge.mock.calls[0][0].map((s) => s.name)).toEqual(['b.pdf', 'a.pdf']);

    m.progress(1, 2);
    expect(screen.getByText('Uniendo: 1 de 2 archivos')).toBeInTheDocument();

    await m.finish();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('unido.pdf');
    expect(screen.getByText('PDF unido: 10 páginas, 1,5 MB.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir el PDF' })).toHaveAttribute(
      'href',
      'blob:merged',
    );

    // Si la lista cambia, el resultado anterior ya no vale.
    await user.click(screen.getByRole('button', { name: 'Quitar a.pdf' }));
    expect(screen.queryByText(/PDF unido/)).not.toBeInTheDocument();
  });

  it('se puede cancelar', async () => {
    const user = userEvent.setup();
    const m = controllableMerge();
    render(<MergePage inspect={inspect} merge={m.merge} />);
    await user.upload(screen.getByTestId('pdf-input'), [pdf('a.pdf'), pdf('b.pdf')]);
    await screen.findByText('En total, 10 páginas');
    await user.click(screen.getByRole('button', { name: 'Unir PDF' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Has cancelado la unión.')).toBeInTheDocument();
  });

  it('si un PDF falla al unir, dice cuál', async () => {
    const user = userEvent.setup();
    const m = controllableMerge();
    render(<MergePage inspect={inspect} merge={m.merge} />);
    await user.upload(screen.getByTestId('pdf-input'), [pdf('a.pdf'), pdf('b.pdf')]);
    await screen.findByText('En total, 10 páginas');
    await user.click(screen.getByRole('button', { name: 'Unir PDF' }));
    await m.fail(new TaskError('unreadable', 'x', 'b.pdf'));
    expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido leer b.pdf');
  });

  it('quita todos los PDF de la lista', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MergePage inspect={inspect} />);
    await user.upload(screen.getByTestId('pdf-input'), [pdf('a.pdf'), pdf('b.pdf')]);
    await screen.findByText('En total, 10 páginas');
    await user.click(screen.getByRole('button', { name: 'Quitar todos' }));
    expect(within(document.body).getByText(/Arrastra aquí los PDF/)).toBeInTheDocument();
  });
});
