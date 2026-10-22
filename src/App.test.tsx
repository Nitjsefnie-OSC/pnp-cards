import { render, screen, within } from '@testing-library/react';
import i18n from './i18n';
import { App } from './App';
import { useExtractStore } from './features/extractImages/extractStore';

beforeAll(() => i18n.changeLanguage('es'));
afterEach(() => {
  window.location.hash = '';
});

describe('App', () => {
  it('muestra la navegación entre herramientas', () => {
    render(<App />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation')).getAllByRole('link')).toHaveLength(5);
  });

  it('la dirección de «PDF a imágenes» abre Extraer imágenes en «Páginas completas»', async () => {
    useExtractStore.setState({ mode: 'images' });
    window.location.hash = '#/pdf-to-images';
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Extraer imágenes' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/extract-images');
    expect(useExtractStore.getState().mode).toBe('pages');
  });
});
