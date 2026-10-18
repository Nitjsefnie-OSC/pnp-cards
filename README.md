# PnP Cards

Herramienta web para preparar cartas de juegos de mesa _print and play_: añades las imágenes de
las cartas, indicas cuántas copias quieres de cada una y obtienes un PDF listo para imprimir y
recortar.

**Úsala aquí:** https://<usuario>.github.io/pnp-cards/

Todo se hace en tu navegador: tus imágenes no se suben a ningún sitio.

## Desarrollo

Requiere Node.js 22 o superior.

```bash
npm install
npm run dev        # servidor de desarrollo
npm test           # tests
npm run lint       # ESLint
npm run build      # build de producción en dist/
```

## Despliegue

Cada push a `main` ejecuta el workflow `.github/workflows/deploy.yml`, que pasa el lint y los
tests, compila y publica en GitHub Pages. En la configuración del repositorio, en
_Settings → Pages_, elige _GitHub Actions_ como origen.
