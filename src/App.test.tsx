import { render, screen } from '@testing-library/react';
import './i18n';
import { App } from './App';

describe('App', () => {
  it('muestra la navegación entre herramientas', () => {
    render(<App />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(6);
  });
});
