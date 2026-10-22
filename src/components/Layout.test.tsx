import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../i18n';
import { Layout } from './Layout';

beforeAll(() => i18n.changeLanguage('es'));

describe('Layout', () => {
  beforeEach(() => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<p>Contenido</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  });

  it('muestra en el pie la versión y el enlace a Privacidad', () => {
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent(`Versión ${__APP_VERSION__}`);
    expect(screen.getByRole('link', { name: 'Privacidad' })).toHaveAttribute('href', '/privacy');
  });

  it('enlaza a PayPal.Me en otra pestaña', () => {
    const donate = screen.getByRole('link', { name: 'Donar (se abre en otra pestaña)' });
    expect(donate).toHaveAttribute('href', 'https://paypal.me/Onzebol/5EUR');
    expect(donate).toHaveAttribute('target', '_blank');
    expect(donate).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
