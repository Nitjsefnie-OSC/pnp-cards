import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../../i18n';
import { HelpPage } from './HelpPage';

beforeAll(() => i18n.changeLanguage('es'));

function renderHelp(path = '/help') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/help/:topic?" element={<HelpPage />} />
        <Route path="/privacy" element={<p>Pantalla de privacidad</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const index = () => screen.getByRole('navigation', { name: 'Temas de ayuda' });

describe('Ayuda', () => {
  it('sin tema abre «Primeros pasos» y lo marca en el índice', async () => {
    renderHelp();
    expect(await screen.findByText(/en tres pasos/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Primeros pasos');
    expect(within(index()).getByRole('link', { name: 'Primeros pasos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(index()).getByRole('link', { name: 'Recorte' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('abre el tema de la dirección y pinta listas y avisos con sus enlaces', async () => {
    renderHelp('/help/cut-lines');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Líneas y margen de corte' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Normales: marcas/)).toBeInTheDocument();
    const article = screen.getByRole('article');
    expect(within(article).getByRole('link', { name: 'Distribución y página' })).toHaveAttribute(
      'href',
      '/help/layout',
    );
  });

  it('al cambiar de tema, el foco va al título', async () => {
    const user = userEvent.setup();
    renderHelp();
    await screen.findByText(/en tres pasos/);
    await user.click(within(index()).getByRole('link', { name: 'Doble cara' }));
    const heading = await screen.findByRole('heading', { level: 1, name: 'Doble cara' });
    expect(heading).toHaveFocus();
    expect(screen.getByText(/en espejo/)).toBeInTheDocument();
  });

  it('un tema que no existe lleva a «Primeros pasos»', async () => {
    renderHelp('/help/no-existe');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Primeros pasos');
  });

  it('la búsqueda filtra el índice y anuncia los resultados', async () => {
    const user = userEvent.setup();
    renderHelp();
    await screen.findByText(/en tres pasos/);
    const search = screen.getByRole('searchbox', { name: 'Buscar en la ayuda' });

    await user.type(search, 'sangrado');
    expect(within(index()).getByRole('link', { name: 'Líneas y margen de corte' })).toBeVisible();
    expect(within(index()).queryByRole('link', { name: 'Unir PDF' })).not.toBeInTheDocument();
    const found = within(index()).getAllByRole('link').length;
    expect(screen.getByText(`${found} temas encontrados`)).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'xyzzy');
    expect(screen.getByText('Ningún tema habla de eso. Prueba con otra palabra.')).toBeVisible();
    expect(within(index()).queryAllByRole('link')).toHaveLength(0);
  });

  it('enlaza a las pantallas de la app', async () => {
    const user = userEvent.setup();
    renderHelp('/help/privacy');
    await user.click(await screen.findByRole('link', { name: /desactivar las estadísticas/ }));
    expect(screen.getByText('Pantalla de privacidad')).toBeInTheDocument();
  });

  it('se traduce al cambiar de idioma', async () => {
    renderHelp('/help/crop');
    await screen.findByText(/10 mm son 118 px/);
    await i18n.changeLanguage('en');
    try {
      expect(await screen.findByText(/10 mm is 118 px/)).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cropping');
    } finally {
      await i18n.changeLanguage('es');
    }
  });
});
