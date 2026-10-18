# PnP Cards

Herramienta web para preparar cartas de juegos de mesa _print and play_: añades las imágenes de
las cartas, indicas cuántas copias quieres de cada una y obtienes un PDF listo para imprimir y
recortar.

**Úsala aquí:** https://onzebol.github.io/pnp-cards/

Todo se hace en tu navegador: tus imágenes no se suben a ningún sitio.

## Cómo se usa

1. **Añade las imágenes** de las cartas con «Añadir imágenes» o arrastrándolas a la bandeja. Se
   ordenan por nombre. Admite JPG, PNG, WebP y TIFF.
2. **Indica las copias** de cada carta. Si el nombre del archivo acaba en ` x3` (por ejemplo,
   `Héroe x3.png`), se añaden 3 copias directamente.
3. **Reordena** arrastrando las miniaturas (o con el teclado: espacio para cogerla, flechas para
   moverla y espacio para soltarla). «Imagen en blanco» añade un hueco del tamaño de la carta
   anterior.
4. **Elige la distribución** en Ajustes:
   - _Página_: vertical 3 × 3 o horizontal 4 × 2 en A4, o manual (columnas × filas en A4, A3 o
     un tamaño en mm).
   - _Colocación_: separadas (con margen) o pegadas y centradas; de derecha a izquierda; doble
     cara (invierte el orden en las páginas pares para que coincidan los reversos).
   - _Tamaño de la carta_: si no lo fuerzas, se usa la resolución (ppp) de cada imagen. Las
     imágenes sin ppp se tratan como de 72 ppp y la app te avisa.
   - _Recorte_: un rectángulo en mm a 300 ppp, centrado en cada imagen o en una posición fija.
     Ajústalo con «Ajustar recorte…» arrastrando el rectángulo.
   - _Corte_: líneas de corte normales, completas o en cruz, y margen de corte (sangrado).
5. **Revisa la vista previa** de cada página y pulsa **Generar PDF**. Se descarga y, si quieres, se
   abre en otra pestaña.

Las imágenes se incrustan en el PDF tal cual, sin volver a comprimirlas, también cuando se
recortan: la calidad de impresión es la de tus archivos.

### Proyectos

Un proyecto `.pnpcards` es un archivo pequeño (JSON) con la configuración y la lista de cartas:
la ruta de cada imagen dentro de su carpeta y sus copias. **Las imágenes no se copian**: siguen en
tu carpeta, organizadas como tú quieras.

- **Añadir carpeta** añade todas las imágenes de una carpeta (y sus subcarpetas). Esa carpeta pasa
  a ser la del proyecto.
- **Guardar archivo** guarda el `.pnpcards`. En Chrome y Edge puedes elegir dónde (por defecto,
  junto a las imágenes); en otros navegadores se descarga.
- **Abrir…** (o soltar el archivo sobre la bandeja) lee el proyecto y te pide la carpeta de las
  imágenes. Se buscan por su ruta y, si no, por su nombre; la app te dice cuáles faltan.
- En **Chrome y Edge** la app recuerda la carpeta: para volver a abrirla basta con pulsar
  «Permitir». En Firefox y Safari hay que elegirla cada vez.
- **Recientes** guarda los últimos proyectos que has abierto o guardado, con su carpeta (no las
  imágenes). Además, al volver a la web te ofrece seguir con tu última sesión.
- Si **instalas la app** (Chrome o Edge en el ordenador: icono de instalar en la barra de
  direcciones), los archivos `.pnpcards` se abren con doble clic.
- Los proyectos **`.bsk` de PDFCartas** se abren igual: eliges la carpeta y se buscan las
  imágenes.

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
