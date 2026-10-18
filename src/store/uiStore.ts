import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';

interface UiState {
  theme: ThemePreference;
  /** Enviar estadísticas anónimas de uso (se puede desactivar en Privacidad). */
  analytics: boolean;
  setTheme: (theme: ThemePreference) => void;
  setAnalytics: (analytics: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      analytics: true,
      setTheme: (theme) => set({ theme }),
      setAnalytics: (analytics) => set({ analytics }),
    }),
    { name: 'pnp-cards-ui' },
  ),
);
