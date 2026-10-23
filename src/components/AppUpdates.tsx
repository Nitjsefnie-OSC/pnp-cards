import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import styles from './AppUpdates.module.css';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches;

/**
 * Botón «Instalar» (solo cuando el navegador lo ofrece: Chrome y Edge) que se oculta tras instalar
 * o si ya se está en la app instalada.
 */
export function InstallButton() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (!isStandalone()) setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!prompt) return null;
  return (
    <button
      type="button"
      className={styles.install}
      onClick={async () => {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') setPrompt(null);
      }}
      aria-label={t('pwa.install')}
      title={t('pwa.install')}
    >
      <svg className={styles.installIcon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v11m0 0-4-4m4 4 4-4M4 17v3h16v-3" />
      </svg>
      <span className={styles.installLabel}>{t('pwa.install')}</span>
    </button>
  );
}

/**
 * Avisos del service worker: versión nueva lista («Actualizar» recarga, «Más tarde» la deja para
 * la próxima vez) y lista para usar sin conexión.
 */
export function UpdateNotice() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!offlineReady) return;
    const timer = setTimeout(() => setOfflineReady(false), 6000);
    return () => clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;
  return (
    <div className={styles.toast} role="status">
      <span>{needRefresh ? t('pwa.newVersion') : t('pwa.offlineReady')}</span>
      {needRefresh ? (
        <span className={styles.actions}>
          <button type="button" className={styles.later} onClick={() => setNeedRefresh(false)}>
            {t('pwa.later')}
          </button>
          <button
            type="button"
            className={styles.update}
            onClick={() => void updateServiceWorker(true)}
          >
            {t('pwa.update')}
          </button>
        </span>
      ) : null}
    </div>
  );
}
