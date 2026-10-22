import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Qué se extrae: las imágenes que lleva el PDF o cada página entera dibujada. */
export type ExtractMode = 'images' | 'pages';

interface ExtractState {
  mode: ExtractMode;
  setMode: (mode: ExtractMode) => void;
}

/** Recuerda el último modo elegido. */
export const useExtractStore = create<ExtractState>()(
  persist(
    (set) => ({
      mode: 'images',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'pnp-cards-extract' },
  ),
);
