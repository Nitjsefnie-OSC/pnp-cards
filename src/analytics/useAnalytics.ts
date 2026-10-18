import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useUiStore } from '../store/uiStore';
import { trackContext, trackPage } from './track';

/** Cuenta cada herramienta como una página (HashRouter) y el contexto una vez por visita. */
export function useAnalytics() {
  const { pathname } = useLocation();
  const { i18n } = useTranslation();

  useEffect(() => {
    trackPage(pathname);
  }, [pathname]);

  useEffect(() => {
    trackContext(i18n.resolvedLanguage ?? 'es', useUiStore.getState().theme);
    // Solo al abrir la app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
