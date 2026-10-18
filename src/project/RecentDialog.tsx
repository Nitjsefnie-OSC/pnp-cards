import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../components/Dialog.module.css';
import { useModalDialog } from '../components/useModalDialog';
import type { RecentProject } from './storage';
import { useProjectStorage } from './storageContext';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Abre un proyecto reciente; false si el usuario no quiere sustituir el actual. */
  onOpen: (entry: RecentProject) => Promise<boolean>;
}

/** Últimos proyectos abiertos o guardados (solo el JSON y la carpeta, sin imágenes). */
export function RecentDialog({ open, onClose, onOpen }: Props) {
  const { t, i18n } = useTranslation();
  const storage = useProjectStorage();
  const ref = useModalDialog(open);
  const titleId = useId();
  const [recent, setRecent] = useState<RecentProject[]>([]);

  const refresh = useCallback(
    () =>
      storage
        .listRecent()
        .then(setRecent)
        .catch(() => setRecent([])),
    [storage],
  );

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h2 id={titleId}>{t('recent.title')}</h2>
        <button type="button" className={styles.secondary} onClick={onClose}>
          {t('recent.close')}
        </button>
      </div>
      <div className={styles.body}>
        {recent.length === 0 ? (
          <p className={styles.muted}>{t('recent.empty')}</p>
        ) : (
          <ul className={styles.list}>
            {recent.map((r) => (
              <li key={r.id} className={styles.item}>
                <span className={styles.itemText}>
                  <span className={styles.itemName}>{r.project.name}</span>
                  <span className={styles.muted}>
                    {t('recent.meta', {
                      count: r.project.cards.filter((c) => c.name).length,
                      date: date.format(r.savedAt),
                    })}
                  </span>
                  {r.folder?.name ? (
                    <span className={styles.muted}>
                      {t('recent.folder', { name: r.folder.name })}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => void onOpen(r).then((ok) => ok && onClose())}
                >
                  {t('recent.open')}
                </button>
                <button
                  type="button"
                  className={styles.link}
                  aria-label={t('recent.removeNamed', { name: r.project.name })}
                  onClick={() => void storage.removeRecent(r.id).then(refresh)}
                >
                  {t('recent.remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.muted}>{t('recent.note')}</p>
      </div>
    </dialog>
  );
}
