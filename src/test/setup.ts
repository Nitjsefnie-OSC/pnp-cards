import '@testing-library/jest-dom/vitest';

// jsdom no implementa matchMedia (los tests con entorno node no tienen window).
if (typeof window !== 'undefined') {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}
