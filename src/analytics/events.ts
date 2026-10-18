import type { LayoutMode } from '../lib/settings';

/**
 * Eventos de uso que se pueden medir. El tipo es cerrado a propósito: solo números (que se
 * agrupan en rangos), valores de una lista fija y códigos de error. Nunca imágenes, nombres de
 * archivo, nombres de proyecto ni rutas.
 */
export type AnalyticsEvent =
  | {
      name: 'pdf-generado';
      pages: number;
      cards: number;
      layout: LayoutMode;
      crop: boolean;
      cutLines: boolean;
      bleed: boolean;
      duplex: boolean;
    }
  | { name: 'pdf-error'; code: string }
  | { name: 'pdf-cancelado' }
  | { name: 'proyecto-abierto'; kind: 'pnpcards' | 'bsk' }
  | { name: 'proyecto-guardado' }
  | { name: 'carpeta-añadida' }
  | { name: 'unir-pdf' }
  | { name: 'dividir-imagen' }
  | { name: 'pdf-a-imagenes' }
  | { name: 'extraer-imagenes' };

export function pagesBucket(n: number) {
  if (n <= 1) return '1';
  if (n <= 5) return '2-5';
  if (n <= 20) return '6-20';
  return 'mas-de-20';
}

export function cardsBucket(n: number) {
  if (n <= 9) return '1-9';
  if (n <= 54) return '10-54';
  if (n <= 200) return '55-200';
  return 'mas-de-200';
}

const LAYOUTS: Record<LayoutMode, string> = {
  vertical9: '3x3',
  horizontal8: '4x2',
  manual: 'manual',
  template: 'plantilla',
};

/** Un código de error sin nada más: minúsculas, letras, números y guiones. */
const clean = (code: string) =>
  code
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

/**
 * Rutas que se cuentan en GoatCounter para un evento: el evento y, aparte, cada dato, para que el
 * panel los sume por separado.
 */
export function eventPaths(event: AnalyticsEvent): string[] {
  const base = event.name;
  switch (event.name) {
    case 'pdf-generado':
      return [
        base,
        `${base}/paginas/${pagesBucket(event.pages)}`,
        `${base}/cartas/${cardsBucket(event.cards)}`,
        `${base}/distribucion/${LAYOUTS[event.layout]}`,
        ...(event.crop ? [`${base}/opcion/recorte`] : []),
        ...(event.cutLines ? [`${base}/opcion/lineas-de-corte`] : []),
        ...(event.bleed ? [`${base}/opcion/margen-de-corte`] : []),
        ...(event.duplex ? [`${base}/opcion/doble-cara`] : []),
      ];
    case 'pdf-error':
      return [base, `${base}/codigo/${clean(event.code)}`];
    case 'proyecto-abierto':
      return [base, `${base}/tipo/${event.kind}`];
    default:
      return [base];
  }
}
