/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages sirve el sitio en https://onzebol.github.io/pnp-cards/
export default defineConfig({
  base: '/pnp-cards/',
  // Versión CalVer (AAAA.MM.DD[.n]) que calcula deploy.yml al publicar; en local y en las PR, «dev».
  define: { __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? 'dev') },
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
