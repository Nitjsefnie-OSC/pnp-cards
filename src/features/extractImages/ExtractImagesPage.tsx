import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { downloadBlob } from '../../components/download';
import { Checkbox } from '../../components/form/Fields';
import { zipFiles } from '../../components/zipFiles';
import { renderExtracted, type ExtractedImage } from '../../pdf/renderExtracted';
import { useCardsStore, type NewImage } from '../../store/cardsStore';
import {
  analyzePdfImages,
  TaskError,
  type AnalyzePdfImages,
  type TaskOptions,
} from '../../workers/pdfClient';
import type { Analysis } from '../../pdf/extractImages';
import { loadImage } from '../cards/loadImages';
import styles from './ExtractImagesPage.module.css';

type Status =
  | { kind: 'idle' }
  | { kind: 'analyzing'; done: number; total: number }
  | { kind: 'rendering'; done: number; total: number }
  | { kind: 'ready'; images: ExtractedImage[]; skipped: number }
  | { kind: 'preparing' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

const MIN_SIZE = 100;
const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
const baseName = (name: string) => name.replace(/\.[^.]+$/, '');
const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');

async function extractedToImages(images: ExtractedImage[]) {
  const loaded: NewImage[] = [];
  for (const i of images)
    loaded.push(await loadImage(new File([i.blob], i.name, { type: i.blob.type })));
  return loaded;
}

/** Miniatura de una imagen extraída (URL temporal mientras se ve). */
function Thumb({ blob }: { blob: Blob }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="" loading="lazy" />;
}

export function ExtractImagesPage({
  analyze = analyzePdfImages,
  renderImages = renderExtracted,
  zip = zipFiles,
  toImages = extractedToImages,
}: {
  analyze?: AnalyzePdfImages;
  renderImages?: (
    analysis: Analysis,
    base: string,
    onProgress?: (done: number, total: number) => void,
  ) => Promise<ExtractedImage[]>;
  zip?: (files: ExtractedImage[]) => Promise<Blob>;
  toImages?: (images: ExtractedImage[]) => Promise<NewImage[]>;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [notPdf, setNotPdf] = useState('');
  const [ignoreSmall, setIgnoreSmall] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [dropping, setDropping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const running =
    status.kind === 'analyzing' || status.kind === 'rendering' || status.kind === 'preparing';
  const images = status.kind === 'ready' ? status.images : [];
  const chosen = images.filter((i) => !excluded.has(i.name));

  function open(f: File | undefined) {
    if (!f) return;
    if (!isPdf(f)) {
      setNotPdf(t('extract.notPdf', { name: f.name }));
      return;
    }
    setNotPdf('');
    setFile(f);
    setStatus({ kind: 'idle' });
  }

  async function extract() {
    if (!file) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const options: TaskOptions = {
      signal: controller.signal,
      onProgress: (done, total) => setStatus({ kind: 'analyzing', done, total }),
    };
    setStatus({ kind: 'analyzing', done: 0, total: 0 });
    try {
      const analysis = await analyze(
        { data: await file.arrayBuffer(), minSize: ignoreSmall ? MIN_SIZE : 0 },
        options,
      );
      if (controller.signal.aborted) throw new DOMException('Cancelado', 'AbortError');
      const result = await renderImages(analysis, baseName(file.name), (done, total) => {
        if (controller.signal.aborted) throw new DOMException('Cancelado', 'AbortError');
        setStatus({ kind: 'rendering', done, total });
      });
      setExcluded(new Set());
      setStatus({ kind: 'ready', images: result, skipped: analysis.skipped });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError')
        setStatus({ kind: 'cancelled' });
      else if (err instanceof TaskError && (err.code === 'encrypted' || err.code === 'unreadable'))
        setStatus({ kind: 'error', message: t(`extract.${err.code}`, { name: file.name }) });
      else
        setStatus({
          kind: 'error',
          message: t('extract.errorUnknown', {
            message: err instanceof Error ? err.message : String(err),
          }),
        });
    } finally {
      abortRef.current = null;
    }
  }

  function toggle(name: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function download() {
    if (!file) return;
    downloadBlob(await zip(chosen), t('extract.zipName', { name: baseName(file.name) }));
  }

  async function addToCards() {
    const selection = chosen;
    setStatus({ kind: 'preparing' });
    useCardsStore.getState().addImages(await toImages(selection));
    navigate('/');
  }

  return (
    <div
      className={styles.page}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropping(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDropping(false);
        open(e.dataTransfer.files[0]);
      }}
    >
      <div className={styles.column}>
        <header className={styles.header}>
          <h1>{t('extract.title')}</h1>
          <p>{t('extract.intro')}</p>
        </header>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          data-testid="pdf-input"
          onChange={(e) => {
            open(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {notPdf ? (
          <p className={styles.error} role="alert">
            {notPdf}
          </p>
        ) : null}

        {!file ? (
          <div className={styles.empty}>
            <p>{t('extract.empty')}</p>
            <button
              type="button"
              className={styles.primary}
              onClick={() => inputRef.current?.click()}
            >
              {t('extract.choose')}
            </button>
          </div>
        ) : (
          <div className={styles.source}>
            <span className={styles.name}>{file.name}</span>
            <Checkbox
              label={t('extract.ignoreSmall')}
              hint={t('extract.ignoreSmallHint')}
              checked={ignoreSmall}
              onChange={setIgnoreSmall}
            />
            <div className={styles.sourceActions}>
              <button
                type="button"
                className={styles.secondary}
                disabled={running}
                onClick={() => inputRef.current?.click()}
              >
                {t('extract.change')}
              </button>
              {status.kind === 'analyzing' || status.kind === 'rendering' ? (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => abortRef.current?.abort()}
                >
                  {t('extract.cancel')}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.primary}
                  disabled={running}
                  onClick={() => void extract()}
                >
                  {t('extract.extract')}
                </button>
              )}
            </div>
          </div>
        )}

        <div aria-live="polite" className={styles.status}>
          {status.kind === 'analyzing' || status.kind === 'rendering' ? (
            <>
              <progress max={status.total || 1} value={status.done} className={styles.progress} />
              <span>
                {t(status.kind === 'analyzing' ? 'extract.analyzing' : 'extract.rendering', {
                  done: status.done,
                  total: status.total,
                })}
              </span>
            </>
          ) : status.kind === 'cancelled' ? (
            <span>{t('extract.cancelled')}</span>
          ) : status.kind === 'preparing' ? (
            <span>{t('extract.preparing')}</span>
          ) : status.kind === 'error' ? (
            <span className={styles.error} role="alert">
              {status.message}
            </span>
          ) : status.kind === 'ready' ? (
            <>
              <span>
                {images.length === 0
                  ? t('extract.none')
                  : t('extract.found', { count: images.length })}
              </span>
              {status.skipped > 0 ? (
                <span className={styles.muted}>
                  {t('extract.skipped', { count: status.skipped })}
                </span>
              ) : null}
            </>
          ) : null}
        </div>

        {images.length > 0 ? (
          <>
            <div className={styles.selectBar}>
              <button type="button" className={styles.link} onClick={() => setExcluded(new Set())}>
                {t('extract.selectAll')}
              </button>
              <button
                type="button"
                className={styles.link}
                onClick={() => setExcluded(new Set(images.map((i) => i.name)))}
              >
                {t('extract.selectNone')}
              </button>
            </div>
            <ul className={styles.grid}>
              {images.map((img) => {
                const on = !excluded.has(img.name);
                return (
                  <li key={img.name} data-off={!on || undefined}>
                    <label className={styles.tile}>
                      <span className={styles.thumb}>
                        <Thumb blob={img.blob} />
                        {img.count > 1 ? <span className={styles.badge}>×{img.count}</span> : null}
                      </span>
                      <span className={styles.tileText}>
                        <input
                          type="checkbox"
                          checked={on}
                          aria-label={t('extract.select', { name: img.name })}
                          onChange={() => toggle(img.name)}
                        />
                        <span className={styles.tileName} title={img.name}>
                          {img.name}
                        </span>
                      </span>
                      <span className={styles.muted}>
                        {t('extract.size', { w: img.width, h: img.height })}
                        {img.count > 1 ? `, ${t('extract.times', { count: img.count })}` : ''}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className={styles.footer}>
              <span>{t('extract.selected', { count: chosen.length })}</span>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={chosen.length === 0 || running}
                  onClick={() => void download()}
                >
                  {t('extract.download')}
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={chosen.length === 0 || running}
                  onClick={() => void addToCards()}
                >
                  {t('extract.addToCards')}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {dropping ? (
        <div className={styles.dropOverlay} aria-hidden="true">
          {t('extract.dropHere')}
        </div>
      ) : null}
    </div>
  );
}
