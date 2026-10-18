import { useEffect } from 'react';
import { useCardsStore } from '../store/cardsStore';
import { useSettingsStore } from '../store/settingsStore';
import { currentProject } from './projectIO';
import { useProjectStorage } from './storageContext';

const DELAY_MS = 1000;

/**
 * Guarda la sesión (el proyecto como JSON y su carpeta, sin imágenes) cada vez que cambian las
 * cartas, el nombre o la configuración. Al volver a la app se ofrece seguir con ella.
 */
export function useSessionAutosave() {
  const storage = useProjectStorage();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      const { cards, folder } = useCardsStore.getState();
      // Una lista vacía no sustituye a la sesión anterior (p. ej. al abrir la app).
      if (cards.length === 0) return;
      storage
        .saveSession({ project: currentProject(), folder })
        .catch((err) => console.warn('No se ha podido guardar la sesión', err));
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(save, DELAY_MS);
    };
    const offCards = useCardsStore.subscribe((s, prev) => {
      if (
        s.cards !== prev.cards ||
        s.back !== prev.back ||
        s.name !== prev.name ||
        s.folder !== prev.folder
      ) {
        schedule();
      }
    });
    const offSettings = useSettingsStore.subscribe((s, prev) => {
      if (s.settings !== prev.settings) schedule();
    });
    return () => {
      clearTimeout(timer);
      offCards();
      offSettings();
    };
  }, [storage]);
}
