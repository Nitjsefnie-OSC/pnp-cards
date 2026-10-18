import { create } from 'zustand';
import type { Dpi } from '../lib/dpi';
import { parseCopies } from '../lib/filename';

export type ImageFormat = 'jpeg' | 'png';

export interface CardImage {
  id: string;
  name: string;
  /** Ruta dentro de la carpeta de imágenes (o el nombre, si se añadió suelta); '' = en blanco. */
  path: string;
  /** null en una imagen en blanco. */
  blob: Blob | null;
  /** Formato de `blob`; las demás imágenes se convierten a PNG al cargarlas. */
  format: ImageFormat;
  widthPx: number;
  heightPx: number;
  dpi: Dpi | null;
  thumbUrl: string | null;
  /**
   * La imagen no se encontró al abrir el proyecto: se conserva (ruta y copias) para no perderla al
   * guardar, pero no se imprime hasta que se encuentre.
   */
  missing?: boolean;
  copies: number;
}

export type NewImage = Omit<CardImage, 'id' | 'copies'>;

/** Carpeta de las imágenes del proyecto. En Chrome y Edge se guarda el acceso para reabrirla. */
export interface ImageFolder {
  name: string;
  handle: FileSystemDirectoryHandle | null;
}

interface CardsState {
  /** Nombre del proyecto ('' = sin nombre). */
  name: string;
  folder: ImageFolder | null;
  cards: CardImage[];
  /** Última carta quitada, para poder deshacerlo. */
  lastRemoved: { card: CardImage; index: number } | null;
  addImages: (images: NewImage[]) => void;
  addBlank: () => void;
  setCopies: (id: string, copies: number) => void;
  remove: (id: string) => void;
  /** Pone la imagen encontrada en una carta que faltaba, con sus mismas copias. */
  replaceImage: (id: string, image: NewImage) => void;
  undoRemove: () => void;
  move: (id: string, overId: string) => void;
  clear: () => void;
  setName: (name: string) => void;
  setFolder: (folder: ImageFolder | null) => void;
  /** Sustituye el proyecto actual por otro. */
  load: (
    name: string,
    cards: (NewImage & { copies: number })[],
    folder: ImageFolder | null,
  ) => void;
  /** Proyecto nuevo: sin nombre ni cartas. */
  reset: () => void;
}

export const totalCards = (cards: CardImage[]) => cards.reduce((n, c) => n + c.copies, 0);

/** Cartas que van al PDF: todas menos las que faltan. */
export const printableCards = (cards: CardImage[]) => cards.filter((c) => !c.missing);

const revoke = (card: CardImage) => {
  if (card.thumbUrl) URL.revokeObjectURL(card.thumbUrl);
};

const revokeAll = (s: CardsState) => {
  s.cards.forEach(revoke);
  if (s.lastRemoved) revoke(s.lastRemoved.card);
};

export const useCardsStore = create<CardsState>()((set) => ({
  name: '',
  folder: null,
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
          path: '',
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

  replaceImage: (id, image) =>
    set((s) => ({
      cards: s.cards.map((c) => {
        if (c.id !== id) return c;
        revoke(c);
        // Si es la misma imagen se conserva su ruta en la carpeta del proyecto.
        const path = image.name === c.name ? c.path : image.path;
        return { ...image, id, path, copies: c.copies, missing: false };
      }),
    })),

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
      revokeAll(s);
      return { cards: [], lastRemoved: null };
    }),

  setName: (name) => set({ name }),

  setFolder: (folder) => set({ folder }),

  load: (name, cards, folder) =>
    set((s) => {
      revokeAll(s);
      return {
        name,
        folder,
        cards: cards.map((c) => ({ ...c, id: crypto.randomUUID() })),
        lastRemoved: null,
      };
    }),

  reset: () =>
    set((s) => {
      revokeAll(s);
      return { name: '', folder: null, cards: [], lastRemoved: null };
    }),
}));
