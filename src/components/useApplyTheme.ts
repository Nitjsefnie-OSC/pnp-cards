import { useEffect } from 'react';
import { useUiStore } from '../store/uiStore';

/** Refleja la preferencia de tema en <html data-theme>, siguiendo al sistema si es "system". */
export function useApplyTheme() {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
