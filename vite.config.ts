/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages sirve el sitio en https://onzebol.github.io/pnp-cards/
export default defineConfig({
  base: '/pnp-cards/',
  plugins: [
    react(),
    VitePWA({
      // La app avisa de las versiones nuevas; no se recarga sola para no perder las cartas.
      registerType: 'prompt',
      injectRegister: null,
      // Se usa el manifiesto de public/ (con file_handlers para .pnpcards).
      manifest: false,
      workbox: {
        // Todo el build, workers de PDF y pdf.js incluidos, para usarla sin conexión.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Sin caché en tiempo de ejecución: las peticiones a otros dominios no pasan por aquí.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  worker: { format: 'es' },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    alias: {
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwaRegisterMock.ts', import.meta.url),
      ),
    },
  },
});
