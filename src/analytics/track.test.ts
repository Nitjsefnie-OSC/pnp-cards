import { analyticsEnabled, track } from './track';

const ok = {
  prod: true,
  hostname: 'onzebol.github.io',
  code: 'pnp-cards',
  doNotTrack: false,
  optedOut: false,
};

describe('analyticsEnabled', () => {
  it('solo mide en la web publicada, con el código configurado', () => {
    expect(analyticsEnabled(ok)).toBe(true);
    expect(analyticsEnabled({ ...ok, prod: false })).toBe(false);
    expect(analyticsEnabled({ ...ok, hostname: 'localhost' })).toBe(false);
    expect(analyticsEnabled({ ...ok, code: undefined })).toBe(false);
    expect(analyticsEnabled({ ...ok, code: '' })).toBe(false);
  });

  it('respeta «no rastrear» y a quien la desactiva', () => {
    expect(analyticsEnabled({ ...ok, doNotTrack: true })).toBe(false);
    expect(analyticsEnabled({ ...ok, optedOut: true })).toBe(false);
  });
});

describe('track', () => {
  it('en los tests (y en desarrollo) no carga nada ni envía nada', () => {
    track({ name: 'unir-pdf' });
    expect(document.querySelector('script[data-goatcounter]')).toBeNull();
  });
});
