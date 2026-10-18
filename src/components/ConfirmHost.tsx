import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { answerConfirm as answer, useConfirmStore } from './confirmAction';
import styles from './Dialog.module.css';
import { useModalDialog } from './useModalDialog';

/** La ventana de confirmación; el foco empieza en «Cancelar» y Esc o pulsar fuera cancelan. */
export function ConfirmHost() {
  const { t } = useTranslation();
  const request = useConfirmStore((s) => s.request);
  const ref = useModalDialog(request !== null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    if (request) cancelRef.current?.focus();
  }, [request]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      role="alertdialog"
      hidden={!request}
      aria-labelledby={titleId}
      aria-describedby={request?.message ? textId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        answer(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          answer(false);
        }
      }}
      onClick={(e) => {
        // Un clic en el fondo (fuera del contenido) cancela.
        if (e.target === e.currentTarget) answer(false);
      }}
    >
      {request ? (
        <div className={styles.confirm}>
          <h2 id={titleId}>{request.title}</h2>
          {request.message ? <p id={textId}>{request.message}</p> : null}
          <div className={styles.confirmActions}>
            <button
              ref={cancelRef}
              type="button"
              className={styles.secondary}
              onClick={() => answer(false)}
            >
              {t('confirm.cancel')}
            </button>
            <button
              type="button"
              className={request.danger ? styles.danger : styles.primary}
              onClick={() => answer(true)}
            >
              {request.confirmLabel}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
