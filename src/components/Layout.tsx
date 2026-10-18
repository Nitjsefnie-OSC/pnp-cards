import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n';
import { useUiStore, type ThemePreference } from '../store/uiStore';
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

export function Layout() {
  const { t, i18n } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  useApplyTheme();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true">
            <rect x="9" y="7" width="14" height="18" rx="1.5" />
            <path d="M9 2v3M23 2v3M9 27v3M23 27v3M2 7h4M26 7h4M2 25h4M26 25h4" />
          </svg>
          <span className={styles.name}>{t('app.name')}</span>
        </div>
        <nav className={styles.nav} aria-label={t('nav.menu')}>
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
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
