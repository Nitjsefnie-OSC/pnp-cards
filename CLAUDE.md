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
- Los tests que usan pdf-lib con archivos (`src/pdf/*.test.ts`) llevan `// @vitest-environment node`;
  las imágenes de prueba están en `src/test/fixtures/`.
- Los componentes reciben las dependencias del navegador por props (`loadImages`, `generatePdf`)
  para poder probarlos en jsdom.

## Arquitectura

- `src/lib/` — lógica pura sin React ni DOM: unidades, maquetación, líneas de corte, sangrado,
  ppp, recorte, división, nombres de archivo, formato de proyecto, formatos de imagen
  (`imageFormat.ts`: detección por bytes, extensiones admitidas e `IMAGE_ACCEPT` de los selectores).
  Todo con tests.
  Coordenadas en puntos PDF (1/72"), origen abajo a la izquierda, como iText y pdf-lib.
  `plan.ts` (`planDocument`) reúne todo: qué carta va en cada hueco, margen y líneas de corte por
  página. Lo usan el PDF y la vista previa, así que nunca difieren. Con reversos, intercala tras
  cada página de cartas una de reversos en espejo (`side: 'back'`); la imagen del reverso común
  vive en `cardsStore.back`, no en la configuración.
- `src/pdf/` — construcción de PDF con pdf-lib (`buildPdf`: cada imagen se incrusta una vez; JPG/PNG
  sin recodificar). Sin APIs de DOM ni de worker, para poder probarlo en entorno node.
- `src/workers/` — un worker por tarea larga (`pdf.worker.ts` genera cartas, `merge.worker.ts` une
  PDF, `heic.worker.ts` pasa fotos HEIC a JPG con libheif-js cuando el navegador no las abre; libheif
  queda fuera del precacheo de Workbox y se guarda al usarse). En el worker, `serveTask` atiende la tarea; en la página, `runWorker` la lanza con
  progreso y la cancela con `terminate()` al abortar la señal. Los clientes están en
  `pdfClient.ts`. Los errores llegan como `TaskError` (`code` y `detail`).
- `src/pdf/pdfjs.ts` — pdf.js se carga bajo demanda (`loadPdfjs`, worker con `?url`); las
  herramientas secundarias se cargan con `React.lazy` para no engordar la carga inicial.
- Plantillas: modelo y geometría en `src/lib/template.ts` (huecos en mm desde arriba a la izquierda,
  giro antihorario; `slotMatrix` para el PDF y `slotSvgMatrix` para la vista previa). La plantilla
  en uso se copia en `settings.template` (viaja con el proyecto); la lista vive en
  `features/templates/templatesStore.ts` (localStorage) y sincroniza esa copia al editarla.
- `src/project/` — proyectos. El `.pnpcards` es solo JSON (`src/lib/project.ts`): configuración y,
  por carta, ruta relativa a su carpeta, nombre, copias y si va sin reverso; y la ruta del
  reverso común (`back`). Las imágenes NO se guardan en ningún sitio
  (ni en el archivo ni en IndexedDB): al abrir se pide la carpeta (`folder.ts`: File System Access
  en Chrome/Edge, que permite recordarla; `webkitdirectory` en el resto) y se emparejan con
  `matchImages` (`src/lib/imageMatch.ts`). IndexedDB (`storage.ts`) guarda la sesión y «Recientes»
  como JSON + carpeta; `createMemoryStorage` para tests, inyectado con `StorageContext`.
  `.bsk` y doble clic (`launchQueue`, `file_handlers` en `public/manifest.webmanifest`) usan el
  mismo flujo.
- `src/store/` — Zustand. La configuración se persiste en localStorage con `persist`;
  las cartas (con sus blobs) no.
- `src/features/<herramienta>/` — componentes de cada herramienta (ruta en HashRouter).
- `src/components/` — componentes compartidos y layout.
- `src/i18n/` — react-i18next, `es.json` y `en.json` (mismas claves en ambos).
- Ayuda: `src/features/help/` (ruta `help/:topic?`). Los temas son una lista fija en `topics.ts`; el
  título de cada uno va en `es.json`/`en.json` (`help.topics.<id>`, lo usan el índice y los botones «?»)
  y el contenido en el espacio de nombres `help` (`help.es.json` y `help.en.json`, cargado bajo
  demanda con `loadHelp`): bloques `p`, `h`, `step`, `list`, `note` y `link`, sin HTML ni Markdown.
  `HelpLink` (`src/components/`) es el botón «?» de las secciones de Ajustes y de cada herramienta.
  Al cambiar o añadir una opción, se actualiza su tema de ayuda en los dos idiomas.
- Estadísticas: `src/analytics/` (GoatCounter). `track()` solo acepta el tipo cerrado
  `AnalyticsEvent` (rangos y valores fijos, nunca nombres); solo se activa en producción, en
  onzebol.github.io, con `VITE_GOATCOUNTER_CODE` y sin Do Not Track ni la casilla desactivada.
- PWA: `vite-plugin-pwa` (Workbox) precarga todo el build para uso sin conexión, con
  `registerType: 'prompt'` (aviso «Actualizar», sin recarga automática) y el manifiesto de `public/`.
  Desactivado en desarrollo; en los tests, `virtual:pwa-register/react` apunta a
  `src/test/pwaRegisterMock.ts`.
- `src/styles/tokens.css` — tokens de color y tipografía; tema oscuro con `[data-theme='dark']`.

## Convenciones

- Estilos con CSS Modules (`*.module.css`) usando las variables de `tokens.css`; nada de colores sueltos.
- Para confirmar, `confirmAction()` (`src/components/confirmAction.ts`, ventana de la app montada en el
  Layout con `<ConfirmHost />`); nunca `alert`/`confirm`/`prompt` (ESLint `no-alert`).
- Todo texto visible pasa por `t()`; se añaden las claves en `es.json` y `en.json` a la vez.
- Textos de la interfaz en sentence case, sin mayúsculas sostenidas.
- TDD en `src/lib`: test que falla primero, valores esperados calculados a mano a partir de las
  fórmulas del original (no recalculados con el mismo código).
- Diferencias deliberadas con el original: conversión mm→pt exacta (72/25,4), recorte centrado
  por imagen, imágenes sin ppp → 72 ppp con aviso (igual que el original).
- Commits al final de cada fase; la rama principal es `main` y despliega a GitHub Pages
  (`base: '/pnp-cards/'` en `vite.config.ts`).
- CI: `.github/workflows/ci.yml` comprueba cada PR (lint, tests y build; su job `build` es el
  check exigido para mergear); `deploy.yml` vuelve a compilar `main` al mergear y lo publica.
- Versión con CalVer `AAAA.MM.DD` (fecha de Madrid del despliegue; `.2`, `.3`… si hay varios el
  mismo día). La calcula `deploy.yml` contando las etiquetas `vAAAA.MM.DD*`, compila con
  `APP_VERSION` (→ `__APP_VERSION__`, que se ve en el pie) y deja la etiqueta `v<versión>`.
  `package.json` no lleva versión: las PR no la tocan, así que dos PR a la vez nunca chocan ni
  repiten número. En local y en las PR se ve «dev».
