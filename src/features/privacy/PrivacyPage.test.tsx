import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';
import { useUiStore } from '../../store/uiStore';
import { PrivacyPage } from './PrivacyPage';

beforeAll(() => i18n.changeLanguage('es'));
beforeEach(() => useUiStore.getState().setAnalytics(true));

describe('Privacidad', () => {
  it('explica qué se cuenta y qué no se cuenta nunca', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/no salen de tu equipo/)).toBeInTheDocument();
    expect(
      screen.getByText(/Imágenes, nombres de archivo, nombres de proyecto/),
    ).toBeInTheDocument();
  });

  it('permite desactivar las estadísticas', async () => {
    const user = userEvent.setup();
    render(<PrivacyPage />);
    await user.click(screen.getByLabelText('Enviar estadísticas anónimas de uso'));
    expect(useUiStore.getState().analytics).toBe(false);
  });
});
