import i18n, { LANGUAGES, type Language } from './index';

/** Espacio de nombres de la ayuda: se carga al abrirla, para no engordar la carga inicial. */
export const HELP_NS = 'help';

const bundles: Record<Language, () => Promise<{ default: object }>> = {
  es: () => import('./help.es.json'),
  en: () => import('./help.en.json'),
};

/** Idioma de la ayuda para el idioma resuelto (o el de reserva si no lo hay). */
export function helpLanguage(lng: string | undefined): Language {
  return (LANGUAGES as readonly string[]).includes(lng ?? '') ? (lng as Language) : 'es';
}

export const hasHelp = (lng: Language) => i18n.hasResourceBundle(lng, HELP_NS);

export async function loadHelp(lng: Language) {
  if (hasHelp(lng)) return;
  const { default: bundle } = await bundles[lng]();
  i18n.addResourceBundle(lng, HELP_NS, bundle);
}
