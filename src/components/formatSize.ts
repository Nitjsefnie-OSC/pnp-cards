/** Tamaño de archivo legible en el idioma de la interfaz: «850 kB», «2,4 MB». */
export function formatSize(bytes: number, language: string | undefined) {
  const mega = bytes >= 1e6;
  return new Intl.NumberFormat(language, {
    style: 'unit',
    unit: mega ? 'megabyte' : 'kilobyte',
    maximumFractionDigits: 1,
  }).format(mega ? bytes / 1e6 : bytes / 1e3);
}
