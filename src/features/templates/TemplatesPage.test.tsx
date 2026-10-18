import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n';
import { parseTemplateFile, serializeTemplate } from '../../lib/template';
import { useCardsStore } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { TemplatesPage } from './TemplatesPage';
import { useTemplatesStore } from './templatesStore';

const renderPage = () =>
  render(
    <MemoryRouter>
      <TemplatesPage />
    </MemoryRouter>,
  );

beforeAll(() => i18n.changeLanguage('es'));
beforeEach(() => {
  useTemplatesStore.setState({ templates: [], selectedId: null, selectedSlotId: null });
  useSettingsStore.getState().reset();
  useCardsStore.getState().reset();
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

describe('Plantillas', () => {
  it('invita a crear una plantilla cuando no hay ninguna', () => {
    renderPage();
    expect(screen.getByText(/Crea una plantilla en blanco/)).toBeInTheDocument();
  });

  it('crea una plantilla en blanco, le añade huecos y edita el elegido', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Nueva en blanco' }));
    expect(screen.getByLabelText('Nombre')).toHaveValue('Plantilla 1');

    await user.click(screen.getByRole('button', { name: 'Añadir hueco' }));
    expect(
      screen.getByRole('button', { name: 'Hueco 1: 63 × 88 mm, giro 0°' }),
    ).toBeInTheDocument();

    const x = screen.getByLabelText('X');
    await user.clear(x);
    await user.type(x, '25');
    await user.click(screen.getByRole('radio', { name: '90°' }));
    const [slot] = useTemplatesStore.getState().templates[0].slots;
    expect(slot).toMatchObject({ xMm: 25, rotation: 90 });
  });

  it('las flechas mueven el hueco elegido 1 mm (10 con Mayús)', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Nueva en blanco' }));
    await user.click(screen.getByRole('button', { name: 'Añadir hueco' }));
    const slot = screen.getByRole('button', { name: /^Hueco 1:/ });
    fireEvent.keyDown(slot, { key: 'ArrowRight' });
    fireEvent.keyDown(slot, { key: 'ArrowDown', shiftKey: true });
    expect(useTemplatesStore.getState().templates[0].slots[0]).toMatchObject({ xMm: 11, yMm: 20 });
  });

  it('crea una plantilla desde la distribución actual (3 × 3 en A4)', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Desde la distribución actual' }));
    expect(screen.getAllByRole('button', { name: /^Hueco \d+:/ })).toHaveLength(9);
    expect(screen.getByText(/210 × 297 mm, 9 huecos/)).toBeInTheDocument();
  });

  it('la usa en Cartas: modo plantilla con una copia de la plantilla', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Desde la distribución actual' }));
    await user.click(screen.getByRole('button', { name: 'Usar en Cartas' }));
    const { settings } = useSettingsStore.getState();
    expect(settings.mode).toBe('template');
    expect(settings.template?.slots).toHaveLength(9);
    expect(screen.getAllByText('En uso en Cartas').length).toBeGreaterThan(0);
  });

  it('avisa de los huecos que se salen de la página', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Nueva en blanco' }));
    await user.click(screen.getByRole('button', { name: 'Añadir hueco' }));
    const x = screen.getByLabelText('X');
    await user.clear(x);
    await user.type(x, '190');
    expect(screen.getByText('Hay huecos que se salen de la página.')).toBeInTheDocument();
  });

  it('exporta e importa plantillas .pnptemplate', async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    let exported: Blob | undefined;
    URL.createObjectURL = vi.fn((b: Blob) => {
      exported = b;
      return 'blob:x';
    });
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Desde la distribución actual' }));
    await user.click(screen.getByRole('button', { name: 'Exportar' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      'Distribución de Cartas.pnptemplate',
    );
    const text = await exported!.text();
    expect(parseTemplateFile(text).slots).toHaveLength(9);

    await user.upload(
      screen.getByTestId('template-input'),
      new File(
        [serializeTemplate({ ...parseTemplateFile(text), name: 'Importada' })],
        'x.pnptemplate',
      ),
    );
    expect(useTemplatesStore.getState().templates.map((t) => t.name)).toEqual([
      'Distribución de Cartas',
      'Importada',
    ]);
  });

  it('avisa si el archivo importado no es una plantilla', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPage();
    await user.upload(screen.getByTestId('template-input'), new File(['hola'], 'mal.pnptemplate'));
    expect(
      await screen.findByText('mal.pnptemplate no es una plantilla de PnP Cards.'),
    ).toBeInTheDocument();
  });
});
