import { createStore, del, get, set } from 'idb-keyval';
import type { ProjectFile } from '../lib/project';
import type { ImageFolder } from '../store/cardsStore';

/** Proyecto guardado en el navegador: solo el JSON y la carpeta, nunca las imágenes. */
export interface StoredProject {
  project: ProjectFile;
  folder: ImageFolder | null;
}

export interface RecentProject extends StoredProject {
  id: string;
  savedAt: number;
}

export const MAX_RECENT = 10;

/** Almacén del navegador (IndexedDB); en los tests se usa uno en memoria. */
export interface ProjectStorage {
  saveSession(session: StoredProject): Promise<void>;
  loadSession(): Promise<StoredProject | undefined>;
  listRecent(): Promise<RecentProject[]>;
  /** Añade o actualiza (por nombre) un proyecto reciente y deja solo los últimos. */
  addRecent(entry: StoredProject): Promise<void>;
  removeRecent(id: string): Promise<void>;
}

/** Las carpetas de File System Access se pueden guardar; en otros navegadores no hay. */
function storable(folder: ImageFolder | null): ImageFolder | null {
  return folder ? { name: folder.name, handle: folder.handle } : null;
}

function withRecent(list: RecentProject[], entry: StoredProject, now: number): RecentProject[] {
  const name = entry.project.name;
  const existing = list.find((r) => r.project.name === name);
  const updated: RecentProject = {
    id: existing?.id ?? crypto.randomUUID(),
    savedAt: now,
    project: entry.project,
    folder: storable(entry.folder),
  };
  return [updated, ...list.filter((r) => r !== existing)].slice(0, MAX_RECENT);
}

export function createIdbStorage(): ProjectStorage {
  const store = createStore('pnp-cards', 'projects');
  const recent = async () => (await get<RecentProject[]>('recent', store)) ?? [];
  return {
    saveSession: (s) => set('session', { project: s.project, folder: storable(s.folder) }, store),
    loadSession: () => get<StoredProject>('session', store),
    listRecent: recent,
    addRecent: async (entry) => set('recent', withRecent(await recent(), entry, Date.now()), store),
    removeRecent: async (id) => {
      const list = (await recent()).filter((r) => r.id !== id);
      return list.length ? set('recent', list, store) : del('recent', store);
    },
  };
}

/** Almacén en memoria, para los tests. */
export function createMemoryStorage(): ProjectStorage {
  let session: StoredProject | undefined;
  let recent: RecentProject[] = [];
  let clock = 0;
  return {
    saveSession: async (s) => void (session = s),
    loadSession: async () => session,
    listRecent: async () => recent,
    addRecent: async (entry) => void (recent = withRecent(recent, entry, ++clock)),
    removeRecent: async (id) => void (recent = recent.filter((r) => r.id !== id)),
  };
}
