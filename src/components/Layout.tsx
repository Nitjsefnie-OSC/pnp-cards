import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n';
import { useUiStore, type ThemePreference } from '../store/uiStore';
import { InstallButton, UpdateNotice } from './AppUpdates';
import { ConfirmHost } from './ConfirmHost';
import { useApplyTheme } from './useApplyTheme';
import styles from './Layout.module.css';

const TOOLS = [
  { to: '/', key: 'cards' },
  { to: '/merge', key: 'merge' },
  { to: '/split', key: 'split' },
  { to: '/pdf-to-images', key: 'pdfToImages' },
  { to: '/extract-images', key: 'extractImages' },
  { to: '/templates', key: 'templates' },
] as const;

/** Donaciones en Ko-fi: tarjeta, Apple/Google Pay o PayPal, sin crearse cuenta. */
const DONATE_URL = 'https://ko-fi.com/onzebol';

export function Layout() {
  const { t, i18n } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  useApplyTheme();
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);

  // En pantallas estrechas la barra se desplaza: que la sección actual quede a la vista.
  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <a
        className={styles.skip}
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        {t('app.skip')}
      </a>
      <header className={styles.header}>
        <div className={styles.brand}>
          <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true">
            <rect x="9" y="7" width="14" height="18" rx="1.5" />
            <path d="M9 2v3M23 2v3M9 27v3M23 27v3M2 7h4M26 7h4M2 25h4M26 25h4" />
          </svg>
          <span className={styles.name} translate="no">
            {t('app.name')}
          </span>
        </div>
        <nav ref={navRef} className={styles.nav} aria-label={t('nav.menu')}>
          {TOOLS.map((tool) => (
            <NavLink
              key={tool.to}
              to={tool.to}
              end={tool.to === '/'}
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.active}` : styles.link
              }
            >
              {t(`nav.${tool.key}`)}
            </NavLink>
          ))}
        </nav>
        <div className={styles.prefs}>
          <a
            className={styles.donate}
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={t('nav.donateHint')}
            aria-label={`${t('nav.donate')} (${t('nav.newTab')})`}
          >
            <svg className={styles.cup} viewBox="0 0 24 24" aria-hidden="true">
              <path
                className={styles.cupBody}
                d="M3 8h14v6a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6Zm14 2h1.5a2.5 2.5 0 0 1 0 5H16.5"
              />
              <path
                className={styles.cupHeart}
                d="M10 16.5s-3.5-2.1-3.5-4.2A1.8 1.8 0 0 1 10 11.4a1.8 1.8 0 0 1 3.5.9c0 2.1-3.5 4.2-3.5 4.2Z"
              />
            </svg>
            {t('nav.donate')}
          </a>
          <InstallButton />
          <label>
            <span className="visually-hidden">{t('theme.label')}</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value as ThemePreference)}>
              <option value="system">{t('theme.system')}</option>
              <option value="light">{t('theme.light')}</option>
              <option value="dark">{t('theme.dark')}</option>
            </select>
          </label>
          <label>
            <span className="visually-hidden">{t('language.label')}</span>
            <select
              value={i18n.resolvedLanguage}
              onChange={(e) => void i18n.changeLanguage(e.target.value)}
            >
              {LANGUAGES.map((lng) => (
                <option key={lng} value={lng}>
                  {lng.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <span>{t('app.version', { version: __APP_VERSION__ })}</span>
        <span aria-hidden="true">·</span>
        <Link to="/privacy">{t('privacy.link')}</Link>
      </footer>
      <ConfirmHost />
      <UpdateNotice />
    </div>
  );
}
