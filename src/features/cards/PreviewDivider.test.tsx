import { fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../i18n';
import { useSettingsStore } from '../../store/settingsStore';
import { PreviewDivider } from './PreviewDivider';

beforeAll(() => i18n.changeLanguage('es'));
beforeEach(() => {
  // 1600 px de ventana: la vista previa puede ir de 280 a 1080 px.
  window.innerWidth = 1600;
  useSettingsStore.getState().setPreviewWidth(380);
});

const divider = () => screen.getByRole('separator', { name: 'Ancho de la vista previa' });

describe('PreviewDivider', () => {
  it('indica el ancho actual y sus límites', () => {
    render(<PreviewDivider />);
    expect(divider()).toHaveAttribute('aria-valuenow', '380');
    expect(divider()).toHaveAttribute('aria-valuemin', '280');
    expect(divider()).toHaveAttribute('aria-valuemax', '1080');
  });

  it('las flechas cambian el ancho de 16 en 16 px y se recuerda', () => {
    render(<PreviewDivider />);
    fireEvent.keyDown(divider(), { key: 'ArrowLeft' });
    fireEvent.keyDown(divider(), { key: 'ArrowLeft' });
    fireEvent.keyDown(divider(), { key: 'ArrowRight' });
    expect(useSettingsStore.getState().previewWidth).toBe(396);
  });

  it('Inicio y Fin llevan al mínimo y al máximo; doble clic vuelve a 380', () => {
    render(<PreviewDivider />);
    fireEvent.keyDown(divider(), { key: 'End' });
    expect(useSettingsStore.getState().previewWidth).toBe(1080);
    fireEvent.keyDown(divider(), { key: 'Home' });
    expect(useSettingsStore.getState().previewWidth).toBe(280);
    fireEvent.doubleClick(divider());
    expect(useSettingsStore.getState().previewWidth).toBe(380);
  });
});
