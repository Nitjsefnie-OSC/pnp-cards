import { createContext, useContext } from 'react';
import { createIdbStorage, createMemoryStorage, type ProjectStorage } from './storage';

let idb: ProjectStorage | null = null;

/**
 * IndexedDB solo se abre cuando se usa por primera vez. Sin IndexedDB (jsdom, algunas ventanas
 * privadas) se guarda en memoria mientras dure la página.
 */
const lazyIdbStorage: ProjectStorage = new Proxy({} as ProjectStorage, {
  get: (_target, key: keyof ProjectStorage) => {
    idb ??= typeof indexedDB === 'undefined' ? createMemoryStorage() : createIdbStorage();
    return idb[key];
  },
});

export const StorageContext = createContext<ProjectStorage>(lazyIdbStorage);

export const useProjectStorage = () => useContext(StorageContext);
