import { create } from 'zustand';
import type { PxRect } from '../../lib/crop';
import type { NewImage } from '../../store/cardsStore';

export interface SplitItem {
  id: string;
  image: NewImage;
  region: PxRect;
  columns: number;
  rows: number;
}

export type SplitSettings = Pick<SplitItem, 'region' | 'columns' | 'rows'>;

interface SplitState {
  items: SplitItem[];
  selectedId: string | null;
  /** Al cambiar los ajustes de una imagen se aplican a todas (como «Todas iguales» del original). */
  sameForAll: boolean;
  add: (images: NewImage[]) => void;
  update: (id: string, patch: Partial<SplitSettings>) => void;
  remove: (id: string) => void;
  clear: () => void;
  select: (id: string) => void;
  setSameForAll: (same: boolean) => void;
}

/** Una zona ajustada para que quepa dentro de una imagen. */
export function fitRegion(region: PxRect, width: number, height: number): PxRect {
  const w = Math.max(1, Math.min(Math.round(region.width), width));
  const h = Math.max(1, Math.min(Math.round(region.height), height));
  return {
    x: Math.min(Math.max(0, Math.round(region.x)), width - w),
    y: Math.min(Math.max(0, Math.round(region.y)), height - h),
    width: w,
    height: h,
  };
}

const fitted = (item: SplitItem, patch: Partial<SplitSettings>): SplitItem => ({
  ...item,
  ...patch,
  region: fitRegion(patch.region ?? item.region, item.image.widthPx, item.image.heightPx),
});

const revoke = (item: SplitItem) => {
  if (item.image.thumbUrl) URL.revokeObjectURL(item.image.thumbUrl);
};

export const useSplitStore = create<SplitState>()((set) => ({
  items: [],
  selectedId: null,
  sameForAll: true,

  add: (images) =>
    set((s) => {
      // Con «mismos ajustes», las nuevas heredan los de la imagen seleccionada.
      const model = s.sameForAll ? s.items.find((i) => i.id === s.selectedId) : undefined;
      const added = images.map((image) => {
        const item: SplitItem = {
          id: crypto.randomUUID(),
          image,
          region: { x: 0, y: 0, width: image.widthPx, height: image.heightPx },
          columns: 3,
          rows: 3,
        };
        return model
          ? fitted(item, { region: model.region, columns: model.columns, rows: model.rows })
          : item;
      });
      return { items: [...s.items, ...added], selectedId: s.selectedId ?? added[0]?.id ?? null };
    }),

  update: (id, patch) =>
    set((s) => ({
      items: s.items.map((item) => (item.id === id || s.sameForAll ? fitted(item, patch) : item)),
    })),

  remove: (id) =>
    set((s) => {
      const index = s.items.findIndex((i) => i.id === id);
      if (index === -1) return s;
      revoke(s.items[index]);
      const items = s.items.filter((i) => i.id !== id);
      const selectedId =
        s.selectedId === id ? (items[Math.min(index, items.length - 1)]?.id ?? null) : s.selectedId;
      return { items, selectedId };
    }),

  clear: () =>
    set((s) => {
      s.items.forEach(revoke);
      return { items: [], selectedId: null };
    }),

  select: (selectedId) => set({ selectedId }),
  setSameForAll: (sameForAll) => set({ sameForAll }),
}));
