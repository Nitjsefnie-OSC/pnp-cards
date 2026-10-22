import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { renderPageThumbnails } from '../../pdf/pdfjs';
import styles from './PagePicker.module.css';
import type { RasterSettings } from './useRasterSettings';

export type RenderThumbs = typeof renderPageThumbnails;

/**
 * Miniatura de cada página para elegir cuáles convertir. Marcar y desmarcar rellena el campo
 * «Páginas» de `settings`, y escribir un rango marca las miniaturas.
 */
export function PagePicker({
  file,
  pageCount,
  settings: s,
  renderThumbs,
  onChange,
}: {
  file: Blob;
  pageCount: number;
  settings: RasterSettings;
  renderThumbs: RenderThumbs;
  onChange?: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  // Las miniaturas van con su archivo: al cambiar de PDF no se ven las del anterior.
  const [thumbs, setThumbs] = useState<{ file: Blob; urls: Record<number, string> }>({
    file,
    urls: {},
  });
  const urls = thumbs.file === file ? thumbs.urls : {};

  useEffect(() => {
    const controller = new AbortController();
    const created: string[] = [];
    renderThumbs(file, {
      signal: controller.signal,
      onThumb: (page, url) => {
        created.push(url);
        setThumbs((prev) => ({
          file,
          urls: { ...(prev.file === file ? prev.urls : {}), [page]: url },
        }));
      },
    }).catch(() => {
      // Sin miniaturas se puede elegir igual, con el número de página.
    });
    return () => {
      controller.abort();
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [file, renderThumbs]);

  const chosen = new Set(s.pages ?? []);
  const act = (fn: () => void) => () => {
    fn();
    onChange?.();
  };

  return (
    <section className={styles.picker} aria-labelledby={titleId}>
      <div className={styles.bar}>
        <h2 id={titleId} className={styles.title}>
          {t('extract.pagesTitle')}
        </h2>
        <span className={styles.count}>
          {t('extract.picked', { count: chosen.size, total: pageCount })}
        </span>
        <button type="button" className={styles.link} onClick={act(s.selectAll)}>
          {t('extract.selectAll')}
        </button>
        <button type="button" className={styles.link} onClick={act(s.selectNone)}>
          {t('extract.selectNone')}
        </button>
      </div>
      {s.pages?.length === 0 ? <p className={styles.error}>{t('extract.pickOne')}</p> : null}
      <ul className={styles.pages}>
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
          <li key={n} data-off={!chosen.has(n) || undefined}>
            <label className={styles.page}>
              <span className={styles.thumb}>
                {urls[n] ? <img src={urls[n]} alt="" /> : <span className={styles.loading} />}
              </span>
              <span className={styles.label}>
                <input
                  type="checkbox"
                  checked={chosen.has(n)}
                  aria-label={t('extract.pageN', { n })}
                  onChange={act(() => s.togglePage(n))}
                />
                {n}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
