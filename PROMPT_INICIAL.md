Vamos a crear desde cero una aplicación web estática, publicable en GitHub Pages, que sustituye a mi
aplicación de escritorio "PDFCartas" (VB.NET WinForms, .NET 4.0, iTextSharp + Magick.NET). El código
original está en C:\Users\lmaim\source\repos\PDFCartas\PDFCartas — léelo como referencia de la lógica,
sobre todo Form1.vb (bgwPDF_DoWork, línea ~222: maquetación de cartas, líneas de corte y margen de corte),
frmRecortar.vb, frmDividir.vb, frmUnir.vb, frmExtraerImagenesPDF.vb, ExtractorImagenesPDF.vb y
My Project/Settings.settings (valores por defecto). No modifiques nada en ese repo.

OBJETIVO
Una herramienta para jugadores de juegos de mesa "print and play": el usuario añade imágenes de cartas,
indica cuántas copias quiere de cada una y genera un PDF listo para imprimir y recortar.
Todo se ejecuta en el navegador: sin servidor y sin subir archivos a ningún sitio.

STACK
- React + TypeScript con Vite, sin backend.
- Estado: Zustand (con su middleware persist para guardar la configuración en localStorage).
- Navegación entre herramientas: React Router con HashRouter (para que funcione en GitHub Pages).
- Estilos: CSS Modules o Tailwind (elige uno y justifícalo), con tema claro y oscuro.
- Reordenar las cartas arrastrando: dnd-kit.
- Internacionalización: react-i18next, en español e inglés (por defecto, el idioma del navegador).
- PDF: pdf-lib para generar y unir; pdfjs-dist para leer PDF y pasar sus páginas a imágenes.
- Imágenes: Canvas para recortar y dividir; JSZip para descargar varias imágenes y para guardar proyectos.
- Generación del PDF en un Web Worker para no bloquear la interfaz (con progreso y cancelación).
- Proyectos guardados como .zip (JSON + imágenes) y, opcionalmente, en IndexedDB.
- Tests con Vitest (+ Testing Library en los componentes clave).
- Despliegue en GitHub Pages con un workflow de GitHub Actions (configura `base` en Vite).

FUNCIONALIDAD (por orden de prioridad)
1. Núcleo: generar el PDF de cartas, igual que bgwPDF_DoWork:
   - Añadir imágenes (selector de archivos y arrastrar y soltar, ordenadas por nombre), miniaturas,
     número de copias por carta, quitar cartas, reordenar arrastrando, contador total de cartas.
   - "Imagen en blanco" (una carta vacía del tamaño de la anterior).
   - Modos: vertical 3x3 en A4, horizontal 4x2 en A4, o manual (columnas x filas; A4, A3 o tamaño
     personalizado en mm; vertical u horizontal).
   - Colocación: separadas (con margen en mm, separación repartida) o pegadas (centradas).
   - De derecha a izquierda, e impresión a doble cara (invertir el orden en las páginas pares).
   - Forzar ancho y/o alto de la carta en mm; si no se fuerza, tamaño según los ppp de la imagen
     (leer los ppp de los metadatos JFIF/EXIF o pHYs; si no hay, comportarse como el original).
   - Recortar: rectángulo en mm a 300 ppp, centrado o con posición X/Y, con vista previa interactiva.
   - Líneas de corte: normales, completas o en cruz, con color y grosor.
   - Margen de corte (sangrado) con color.
   - Vista previa de la maquetación de una página antes de generar el PDF.
   - Barra de progreso, botón de cancelar, y descargar o abrir el PDF al terminar.
   - Incrustar los JPG y PNG sin volver a codificarlos cuando no hay recorte (para ahorrar memoria).
2. Unir varios PDF en uno (con orden).
3. Dividir una imagen en partes iguales (filas x columnas, con recorte previo) y descargar
   las partes en un .zip.
4. Pasar las páginas de un PDF a imágenes (pdf.js a canvas, JPG a la resolución elegida) y descargarlas
   en un .zip.
5. Extraer las imágenes incrustadas de un PDF (lo mejor posible con pdf.js).
6. Plantillas con posiciones libres (ver pagina.vb y bgwPDF_Plantilla_DoWork).
No hace falta: la actualización automática ni los enlaces de donación con las URL antiguas.

FORMA DE TRABAJAR
- Antes de escribir código, lee el código VB de referencia y proponme un plan breve: estructura de
  carpetas, decisiones técnicas y fases. Espera a que lo apruebe.
- Separa la lógica de maquetación (funciones puras en TypeScript, sin React, en src/lib: posiciones,
  separaciones, líneas de corte) de los componentes. Escribe tests que comprueben los cálculos frente
  a los del original.
- Implementa por fases, empezando por el núcleo (1), y haz un commit al final de cada fase.
- Configura ESLint y Prettier.
- Crea un CLAUDE.md con los comandos (dev, build, test, lint), la arquitectura y las convenciones,
  y un README en español con instrucciones de uso y el enlace de GitHub Pages.
- La interfaz debe ser usable en el portátil y razonablemente en el móvil.
