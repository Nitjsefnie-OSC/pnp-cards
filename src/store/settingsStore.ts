import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SETTINGS, type LayoutSettings } from '../lib/settings';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

interface SettingsState {
  settings: LayoutSettings;
  /** Abrir el PDF en una pestaña nueva al terminar, además de descargarlo. */
  openAfter: boolean;
  update: (patch: Partial<LayoutSettings>) => void;
  setOpenAfter: (open: boolean) => void;
  reset: () => void;
}

/** Completa una configuración guardada (quizá de una versión anterior) con los valores por defecto. */
export function mergeSettings(saved: DeepPartial<LayoutSettings> | undefined): LayoutSettings {
  const d = DEFAULT_SETTINGS;
  return {
    ...d,
    ...saved,
    customPageMm: { ...d.customPageMm, ...saved?.customPageMm },
    crop: { ...d.crop, ...saved?.crop },
    cutLines: { ...d.cutLines, ...saved?.cutLines },
    bleed: { ...d.bleed, ...saved?.bleed },
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      openAfter: true,
      update: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setOpenAfter: (openAfter) => set({ openAfter }),
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
