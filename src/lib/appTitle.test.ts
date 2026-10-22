import { describe, expect, it } from 'vitest';
import { appTitle } from './appTitle';

describe('appTitle', () => {
  it('añade la versión al nombre en la app instalada', () => {
    expect(appTitle('1.3.0', true)).toBe('PnP Cards 1.3.0');
  });

  it('deja solo el nombre en el navegador', () => {
    expect(appTitle('1.3.0', false)).toBe('PnP Cards');
  });
});
