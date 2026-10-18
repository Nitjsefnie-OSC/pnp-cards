import { useUiStore } from '../store/uiStore';
import { eventPaths, type AnalyticsEvent } from './events';

/** Dominio de la web publicada: fuera de él (localhost, vistas previas) no se mide nada. */
const SITE_HOST = 'onzebol.github.io';
const SCRIPT_URL = 'https://gc.zgo.at/count.js';

interface GoatCounter {
  count(vars: { path: string; title?: string; event?: boolean }): void;
}
declare global {
  interface Window {
    goatcounter?: GoatCounter;
  }
  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}

export interface AnalyticsContext {
  prod: boolean;
  hostname: string;
  /** Código de la cuenta de GoatCounter (VITE_GOATCOUNTER_CODE al compilar). */
  code: string | undefined;
  doNotTrack: boolean;
  optedOut: boolean;
}

/** Si se pueden enviar estadísticas anónimas. */
export function analyticsEnabled(c: AnalyticsContext) {
  return c.prod && c.hostname === SITE_HOST && !!c.code && !c.doNotTrack && !c.optedOut;
}

function currentContext(): AnalyticsContext {
  return {
    prod: import.meta.env.PROD,
    hostname: window.location.hostname,
    code: import.meta.env.VITE_GOATCOUNTER_CODE,
    doNotTrack: navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true,
    optedOut: !useUiStore.getState().analytics,
  };
}

/** Recuentos pendientes mientras carga el script (o si un bloqueador lo impide, se pierden). */
let pending: { path: string; event: boolean }[] = [];
let loading = false;

function flush() {
  const gc = window.goatcounter;
  if (!gc) return;
  for (const item of pending) gc.count({ path: item.path, title: item.path, event: item.event });
  pending = [];
}

function send(paths: string[], event: boolean) {
  const context = currentContext();
  if (!analyticsEnabled(context)) return;
  pending.push(...paths.map((path) => ({ path, event })));
  if (window.goatcounter) return flush();
  if (loading) return;
  loading = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = SCRIPT_URL;
  script.dataset.goatcounter = `https://${context.code}.goatcounter.com/count`;
  // Sin recuento automático: lo hace la app al cambiar de herramienta (HashRouter).
  script.dataset.goatcounterSettings = JSON.stringify({ no_onload: true });
  script.addEventListener('load', flush);
  document.head.append(script);
}

/** Cuenta un evento de uso (sin datos personales). No hace nada si las estadísticas están apagadas. */
export function track(event: AnalyticsEvent) {
  send(eventPaths(event), true);
}

/** Cuenta la visita a una herramienta (`/`, `/merge`…). */
export function trackPage(path: string) {
  send([path], false);
}

/** Idioma, tema y si la app está instalada, una vez por visita. */
export function trackContext(language: string, theme: string) {
  const installed = window.matchMedia('(display-mode: standalone)').matches;
  send(
    [
      `contexto/idioma/${language}`,
      `contexto/tema/${theme}`,
      `contexto/instalada/${installed ? 'si' : 'no'}`,
    ],
    true,
  );
}
