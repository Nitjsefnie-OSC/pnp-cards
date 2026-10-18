import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_PREVIEW_WIDTH } from '../lib/previewWidth';
import { DEFAULT_SETTINGS, mergeSettings, type LayoutSettings } from '../lib/settings';

interface SettingsState {
  settings: LayoutSettings;
  /** Abrir el PDF en una pestaña nueva al terminar, además de descargarlo. */
  openAfter: boolean;
  /** Ancho de la columna de la vista previa en Cartas (px); no forma parte del proyecto. */
  previewWidth: number;
  update: (patch: Partial<LayoutSettings>) => void;
  setOpenAfter: (open: boolean) => void;
  setPreviewWidth: (width: number) => void;
  /**
   * Sustituye toda la configuración (al abrir un proyecto). Se completa con los valores por
   * defecto: las sesiones y los recientes guardados por versiones anteriores no la tienen entera.
   */
  replace: (settings: LayoutSettings) => void;
  reset: () => void;
}

type Persisted = Partial<Pick<SettingsState, 'settings' | 'openAfter' | 'previewWidth'>>;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      openAfter: true,
      previewWidth: DEFAULT_PREVIEW_WIDTH,
      update: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setOpenAfter: (openAfter) => set({ openAfter }),
      setPreviewWidth: (previewWidth) => set({ previewWidth }),
      replace: (settings) => set({ settings: mergeSettings(settings) }),
      reset: () => set({ settings: DEFAULT_SETTINGS, openAfter: true }),
    }),
    {
      name: 'pnp-cards-settings',
      version: 1,
      partialize: (s) => ({
        settings: s.settings,
        openAfter: s.openAfter,
        previewWidth: s.previewWidth,
      }),
      merge: (persisted, current) => {
        const p = persisted as Persisted | undefined;
        return {
          ...current,
          settings: mergeSettings(p?.settings),
          openAfter: p?.openAfter ?? current.openAfter,
          previewWidth: typeof p?.previewWidth === 'number' ? p.previewWidth : current.previewWidth,
        };
      },
    },
  ),
);
