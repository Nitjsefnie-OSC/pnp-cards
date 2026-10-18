import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveGrid } from '../../lib/layout';
import { totalCards, useCardsStore } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';
import {
  generatePdf as defaultGeneratePdf,
  PdfError,
  type GeneratePdf,
} from '../../workers/pdfClient';
import styles from './CardsPage.module.css';

type Status =
  | { kind: 'idle' }
  | { kind: 'running'; done: number; total: number }
  | { kind: 'ready'; url: string; bytes: number; pages: number }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

function download(url: string, fileName: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
}

export function PrintPanel({ generatePdf = defaultGeneratePdf }: { generatePdf?: GeneratePdf }) {
  const { t, i18n } = useTranslation();
  const total = useCardsStore((s) => totalCards(s.cards));
  const perPage = useSettingsStore((s) => resolveGrid(s.settings).perPage);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const pages = Math.ceil(total / perPage);
  const readyUrl = status.kind === 'ready' ? status.url : null;

  // Libera el PDF anterior al generar otro o al salir de la pantalla.
  useEffect(() => {
    return () => {
      if (readyUrl) URL.revokeObjectURL(readyUrl);
    };
  }, [readyUrl]);

  async function generate() {
    const { cards } = useCardsStore.getState();
    const { settings, openAfter } = useSettingsStore.getState();
    const fileName = t('cards.fileName');
    // La pestaña se abre ya, durante el clic, para que el navegador no la bloquee.
    const tab = openAfter ? window.open('', '_blank') : null;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ kind: 'running', done: 0, total: totalCards(cards) });

    try {
      const pdf = await generatePdf(
        {
          settings,
          title: t('cards.pdfTitle'),
          cards: cards.map((c) => ({
            data: c.blob,
            format: c.format,
            widthPx: c.widthPx,
            heightPx: c.heightPx,
            dpi: c.dpi,
            copies: c.copies,
          })),
        },
        {
          signal: controller.signal,
          onProgress: (done, all) => setStatus({ kind: 'running', done, total: all }),
        },
      );
      const url = URL.createObjectURL(
        new Blob([pdf as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      );
      download(url, fileName);
      if (tab) tab.location.href = url;
      setStatus({
        kind: 'ready',
        url,
        bytes: pdf.byteLength,
        pages: Math.ceil(totalCards(cards) / resolveGrid(settings).perPage),
      });
    } catch (err) {
      tab?.close();
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus({ kind: 'cancelled' });
      } else if (err instanceof PdfError && err.code === 'blank-without-size') {
        setStatus({ kind: 'error', message: t('cards.errorBlank') });
      } else if (err instanceof PdfError && err.code === 'empty') {
        setStatus({ kind: 'error', message: t('cards.errorEmpty') });
      } else {
        setStatus({
          kind: 'error',
          message: t('cards.errorUnknown', {
            message: err instanceof Error ? err.message : String(err),
          }),
        });
      }
    } finally {
      abortRef.current = null;
    }
  }

  const size = (bytes: number) =>
    new Intl.NumberFormat(i18n.resolvedLanguage, {
      style: 'unit',
      unit: bytes >= 1e6 ? 'megabyte' : 'kilobyte',
      maximumFractionDigits: 1,
    }).format(bytes >= 1e6 ? bytes / 1e6 : bytes / 1e3);

  const running = status.kind === 'running';

  return (
    <div className={styles.print}>
      <div className={styles.mat}>
        <p>{t('cards.previewSoon')}</p>
      </div>
      <div className={styles.printArea}>
        <div aria-live="polite" className={styles.status}>
          {status.kind === 'running' ? (
            <>
              <progress max={status.total} value={status.done} className={styles.progress} />
              <span>{t('cards.generating', { done: status.done, total: status.total })}</span>
            </>
          ) : null}
          {status.kind === 'ready' ? (
            <>
              <span>
                {t('cards.ready', {
                  pages: t('cards.pages', { count: status.pages }),
                  size: size(status.bytes),
                })}
              </span>
              <span className={styles.links}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => download(status.url, t('cards.fileName'))}
                >
                  {t('cards.downloadAgain')}
                </button>
                <a href={status.url} target="_blank" rel="noopener">
                  {t('cards.openPdf')}
                </a>
              </span>
            </>
          ) : null}
          {status.kind === 'cancelled' ? <span>{t('cards.cancelled')}</span> : null}
          {status.kind === 'error' ? (
            <span role="alert" className={styles.error}>
              {status.message}
            </span>
          ) : null}
        </div>
        <div className={styles.printBar}>
          <span className={styles.pages}>
            {total > 0 ? t('cards.pages', { count: pages }) : null}
          </span>
          {running ? (
            <button
              type="button"
              className={styles.cancel}
              onClick={() => abortRef.current?.abort()}
            >
              {t('cards.cancel')}
            </button>
          ) : (
            <button
              type="button"
              className={styles.generate}
              disabled={total === 0}
              onClick={() => void generate()}
            >
              {t('cards.generate')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
