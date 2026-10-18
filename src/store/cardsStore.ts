import { create } from 'zustand';
import type { Dpi } from '../lib/dpi';
import { parseCopies } from '../lib/filename';

export type ImageFormat = 'jpeg' | 'png';

export interface CardImage {
  id: string;
  name: string;
  /** null en una imagen en blanco. */
  blob: Blob | null;
  /** Formato de `blob`; las demás imágenes se convierten a PNG al cargarlas. */
  format: ImageFormat;
  widthPx: number;
  heightPx: number;
  dpi: Dpi | null;
  thumbUrl: string | null;
  copies: number;
}

export type NewImage = Omit<CardImage, 'id' | 'copies'>;

interface CardsState {
  cards: CardImage[];
  /** Última carta quitada, para poder deshacerlo. */
  lastRemoved: { card: CardImage; index: number } | null;
  addImages: (images: NewImage[]) => void;
  addBlank: () => void;
  setCopies: (id: string, copies: number) => void;
  remove: (id: string) => void;
  undoRemove: () => void;
  move: (id: string, overId: string) => void;
  clear: () => void;
}

export const totalCards = (cards: CardImage[]) => cards.reduce((n, c) => n + c.copies, 0);

const revoke = (card: CardImage) => {
  if (card.thumbUrl) URL.revokeObjectURL(card.thumbUrl);
};

export const useCardsStore = create<CardsState>()((set) => ({
  cards: [],
  lastRemoved: null,

  addImages: (images) =>
    set((s) => ({
      cards: [
        ...s.cards,
        ...images.map((img) => ({
          ...img,
          id: crypto.randomUUID(),
          copies: parseCopies(img.name) ?? 1,
        })),
      ],
    })),

  addBlank: () =>
    set((s) => ({
      cards: [
        ...s.cards,
        {
          id: crypto.randomUUID(),
          name: '',
          blob: null,
          format: 'png',
          widthPx: 0,
          heightPx: 0,
          dpi: null,
          thumbUrl: null,
          copies: 1,
        },
      ],
    })),

  setCopies: (id, copies) =>
    set((s) => ({
      cards: s.cards.map((c) =>
        c.id === id ? { ...c, copies: Math.max(1, Math.floor(copies) || 1) } : c,
      ),
    })),

  remove: (id) =>
    set((s) => {
      const index = s.cards.findIndex((c) => c.id === id);
      if (index === -1) return s;
      // La miniatura de la carta quitada se conserva hasta que ya no se pueda deshacer.
      if (s.lastRemoved) revoke(s.lastRemoved.card);
      return {
        cards: s.cards.filter((c) => c.id !== id),
        lastRemoved: { card: s.cards[index], index },
      };
    }),

  undoRemove: () =>
    set((s) => {
      if (!s.lastRemoved) return s;
      const { card, index } = s.lastRemoved;
      const cards = [...s.cards];
      cards.splice(Math.min(index, cards.length), 0, card);
      return { cards, lastRemoved: null };
    }),

  move: (id, overId) =>
    set((s) => {
      const from = s.cards.findIndex((c) => c.id === id);
      const to = s.cards.findIndex((c) => c.id === overId);
      if (from === -1 || to === -1 || from === to) return s;
      const cards = [...s.cards];
      const [card] = cards.splice(from, 1);
      cards.splice(to, 0, card);
      return { cards };
    }),

  clear: () =>
    set((s) => {
      s.cards.forEach(revoke);
      if (s.lastRemoved) revoke(s.lastRemoved.card);
      return { cards: [], lastRemoved: null };
    }),
}));
