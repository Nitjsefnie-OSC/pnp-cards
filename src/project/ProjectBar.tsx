import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCardsStore } from '../store/cardsStore';
import { PROJECT_EXTENSION } from '../lib/project';
import { FolderDialog } from './FolderDialog';
import { RecentDialog } from './RecentDialog';
import type { useProjectActions } from './useProjectActions';
import styles from './ProjectBar.module.css';

type Actions = ReturnType<typeof useProjectActions>;

/** Nombre del proyecto y acciones de archivo: nuevo, abrir, guardar y recientes. */
export function ProjectBar({ actions }: { actions: Actions }) {
  const { t } = useTranslation();
  const nameId = useId();
  const name = useCardsStore((s) => s.name);
  const hasCards = useCardsStore((s) => s.cards.length > 0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const { message } = actions;

  return (
    <div className={styles.bar}>
      <div className={styles.row}>
        <label htmlFor={nameId} className="visually-hidden">
          {t('project.name')}
        </label>
        <input
          id={nameId}
          className={styles.name}
          value={name}
          placeholder={t('project.defaultName')}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => useCardsStore.getState().setName(e.target.value)}
        />
        <div className={styles.buttons}>
          <button type="button" onClick={() => void actions.newProject()} disabled={actions.busy}>
            {t('project.new')}
          </button>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={actions.busy}>
            {t('project.open')}
          </button>
          <button
            type="button"
            onClick={() => void actions.saveFile()}
            disabled={!hasCards || actions.busy}
          >
            {t('project.save')}
          </button>
          <button type="button" onClick={() => setRecentOpen(true)} disabled={actions.busy}>
            {t('project.recent')}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={`${PROJECT_EXTENSION},.bsk`}
          hidden
          data-testid="project-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void actions.openFile(file);
          }}
        />
      </div>
      <p className={styles.message} data-tone={message?.tone} role="status">
        {message?.text}
      </p>
      <RecentDialog
        open={recentOpen}
        onClose={() => setRecentOpen(false)}
        onOpen={actions.openRecent}
      />
      <FolderDialog actions={actions} />
    </div>
  );
}
