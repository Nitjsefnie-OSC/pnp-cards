import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SETTINGS, mergeSettings, type LayoutSettings } from '../lib/settings';

interface SettingsState {
  settings: LayoutSettings;
  /** Abrir el PDF en una pestaña nueva al terminar, además de descargarlo. */
  openAfter: boolean;
  update: (patch: Partial<LayoutSettings>) => void;
  setOpenAfter: (open: boolean) => void;
  /** Sustituye toda la configuración (al abrir un proyecto). */
  replace: (settings: LayoutSettings) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      openAfter: true,
      update: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setOpenAfter: (openAfter) => set({ openAfter }),
      replace: (settings) => set({ settings }),
      reset: () => set({ settings: DEFAULT_SETTINGS, openAfter: true }),
    }),
    {
      name: 'pnp-cards-settings',
      version: 1,
      partialize: (s) => ({ settings: s.settings, openAfter: s.openAfter }),
      merge: (persisted, current) => {
        const p = persisted as Partial<Pick<SettingsState, 'settings' | 'openAfter'>> | undefined;
        return {
          ...current,
          settings: mergeSettings(p?.settings),
          openAfter: p?.openAfter ?? current.openAfter,
        };
      },
    },
  ),
);
