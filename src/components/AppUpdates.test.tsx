import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../i18n';
import { pwaMock } from '../test/pwaRegisterMock';
import { InstallButton, UpdateNotice } from './AppUpdates';

beforeAll(() => i18n.changeLanguage('es'));
beforeEach(() => {
  pwaMock.needRefresh = false;
  pwaMock.offlineReady = false;
  pwaMock.updateServiceWorker.mockClear();
});

/** Evento que lanza Chrome cuando la app se puede instalar. */
function installEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn(async () => {});
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  return { event, prompt };
}

describe('InstallButton', () => {
  it('no aparece hasta que el navegador ofrece instalar la app', () => {
    render(<InstallButton />);
    expect(screen.queryByRole('button', { name: 'Instalar' })).not.toBeInTheDocument();
  });

  it('abre el diálogo de instalación del navegador y se oculta al instalar', async () => {
    const user = userEvent.setup();
    render(<InstallButton />);
    const { event, prompt } = installEvent('accepted');
    act(() => void window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(prompt).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Instalar' })).not.toBeInTheDocument();
  });

  it('se oculta cuando la app queda instalada', () => {
    render(<InstallButton />);
    act(() => void window.dispatchEvent(installEvent('dismissed').event));
    act(() => void window.dispatchEvent(new Event('appinstalled')));
    expect(screen.queryByRole('button', { name: 'Instalar' })).not.toBeInTheDocument();
  });
});

describe('UpdateNotice', () => {
  it('sin novedades no muestra nada', () => {
    render(<UpdateNotice />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('avisa de una versión nueva: «Actualizar» recarga y «Más tarde» la aparca', async () => {
    const user = userEvent.setup();
    pwaMock.needRefresh = true;
    render(<UpdateNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('Hay una versión nueva de PnP Cards.');

    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(pwaMock.updateServiceWorker).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole('button', { name: 'Más tarde' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('dice cuando ya funciona sin conexión', () => {
    pwaMock.offlineReady = true;
    render(<UpdateNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('PnP Cards ya funciona sin conexión.');
  });
});
