# PnP Cards

Aplicación web estática (React + TypeScript + Vite) que sustituye a la app de escritorio
"PDFCartas" (VB.NET). Genera PDF de cartas print and play en el navegador, sin servidor.
Código de referencia (solo lectura, no modificar): `C:\Users\lmaim\source\repos\PDFCartas\PDFCartas`
— sobre todo `Form1.vb` (`bgwPDF_DoWork`).

## Comandos

- `npm run dev` — servidor de desarrollo
- `npm run build` — comprobación de tipos (`tsc -b`) y build de producción en `dist/`
- `npm test` — tests con Vitest (una pasada); `npm run test:watch` en modo watch
- `npm run lint` — ESLint; `npm run format` / `npm run format:check` — Prettier
- `npx vitest run src/lib/layout.test.ts` — un solo archivo de tests

## Arquitectura

- `src/lib/` — lógica pura sin React ni DOM: unidades, maquetación, líneas de corte, sangrado,
  ppp, recorte, división, nombres de archivo, formato de proyecto. Todo con tests.
  Coordenadas en puntos PDF (1/72"), origen abajo a la izquierda, como iText y pdf-lib.
- `src/workers/` — Web Worker que genera el PDF con pdf-lib (progreso y cancelación por mensajes).
- `src/pdf/` — utilidades de PDF que se ejecutan en el hilo principal (unir, rasterizar con pdfjs).
- `src/store/` — Zustand. La configuración se persiste en localStorage con `persist`;
  las cartas (con sus blobs) no.
- `src/features/<herramienta>/` — componentes de cada herramienta (ruta en HashRouter).
- `src/components/` — componentes compartidos y layout.
- `src/i18n/` — react-i18next, `es.json` y `en.json` (mismas claves en ambos).
- `src/styles/tokens.css` — tokens de color y tipografía; tema oscuro con `[data-theme='dark']`.

## Convenciones

- Estilos con CSS Modules (`*.module.css`) usando las variables de `tokens.css`; nada de colores sueltos.
- Todo texto visible pasa por `t()`; se añaden las claves en `es.json` y `en.json` a la vez.
- Textos de la interfaz en sentence case, sin mayúsculas sostenidas.
- TDD en `src/lib`: test que falla primero, valores esperados calculados a mano a partir de las
  fórmulas del original (no recalculados con el mismo código).
- Diferencias deliberadas con el original: conversión mm→pt exacta (72/25,4), recorte centrado
  por imagen, imágenes sin ppp → 72 ppp con aviso (igual que el original).
- Commits al final de cada fase; la rama principal es `main` y despliega a GitHub Pages
  (`base: '/pnp-cards/'` en `vite.config.ts`).
