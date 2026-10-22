const APP_NAME = 'PnP Cards';

/** Título de la ventana: en la app instalada lleva la versión al lado del nombre. */
export function appTitle(version: string, installed: boolean): string {
  return installed ? `${APP_NAME} ${version}` : APP_NAME;
}
