import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { track } from '../../analytics/track';
import { useNavigate } from 'react-router-dom';
import { downloadBlob } from '../../components/download';
import { Checkbox, RadioGroup } from '../../components/form/Fields';
import { zipFiles } from '../../components/zipFiles';
import { inspectPdf, type PdfInfo } from '../../pdf/pdfjs';
import { rasterizePdf, type PageImage, type RasterOptions } from '../../pdf/rasterize';
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
import { RasterFields } from '../pdfToImages/RasterFields';
import { useRasterSettings } from '../pdfToImages/useRasterSettings';
import { useSplitStore } from '../split/splitStore';
import { useExtractStore, type ExtractMode } from './extractStore';
import styles from './ExtractImagesPage.module.css';

type Info = { kind: 'reading' } | { kind: 'ready'; info: PdfInfo } | { kind: 'unreadable' };

type Status =
  | { kind: 'idle' }
  | { kind: 'analyzing'; done: number; total: number }
  | { kind: 'rendering'; done: number; total: number }
  | { kind: 'drawing'; done: number; total: number }
  | { kind: 'ready'; mode: ExtractMode; images: ExtractedImage[]; skipped: number }
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

/** Las páginas dibujadas, como imágenes extraídas que aparecen una vez. */
const pagesToExtracted = (pages: PageImage[]): ExtractedImage[] =>
  pages.map((p) => ({ ...p, count: 1 }));

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
  inspect = inspectPdf,
  rasterize = rasterizePdf,
}: {
  analyze?: AnalyzePdfImages;
  renderImages?: (
    analysis: Analysis,
    base: string,
    onProgress?: (done: number, total: number) => void,
  ) => Promise<ExtractedImage[]>;
  zip?: (files: ExtractedImage[]) => Promise<Blob>;
  toImages?: (images: ExtractedImage[]) => Promise<NewImage[]>;
  inspect?: (file: Blob) => Promise<PdfInfo>;
  rasterize?: (file: Blob, baseName: string, options: RasterOptions) => Promise<PageImage[]>;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<Info>({ kind: 'reading' });
  const { mode, setMode } = useExtractStore();
  const raster = useRasterSettings(info.kind === 'ready' ? info.info : null);
  const [notPdf, setNotPdf] = useState('');
  const [ignoreSmall, setIgnoreSmall] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [dropping, setDropping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const working =
    status.kind === 'analyzing' || status.kind === 'rendering' || status.kind === 'drawing';
  const running = working || status.kind === 'preparing';
  const pagesMode = mode === 'pages';
  const canExtract = !pagesMode || (info.kind === 'ready' && raster.pages !== null);
  const images = status.kind === 'ready' ? status.images : [];
  const chosen = images.filter((i) => !excluded.has(i.name));

  async function open(f: File | undefined) {
    if (!f) return;
    if (!isPdf(f)) {
      setNotPdf(t('extract.notPdf', { name: f.name }));
      return;
    }
    setNotPdf('');
    setFile(f);
    setStatus({ kind: 'idle' });
    raster.setRange('');
    setInfo({ kind: 'reading' });
    try {
      const read = await inspect(f);
      // Aquí no se enseña la miniatura.
      if (read.thumbUrl) URL.revokeObjectURL(read.thumbUrl);
      setInfo({ kind: 'ready', info: read });
    } catch {
      setInfo({ kind: 'unreadable' });
    }
  }

  function changeMode(next: ExtractMode) {
    setMode(next);
    setExcluded(new Set());
    setStatus((s) => (s.kind === 'ready' || s.kind === 'cancelled' ? { kind: 'idle' } : s));
  }

  async function extractPages(f: File, signal: AbortSignal) {
    const pages = raster.pages;
    if (!pages) return;
    setStatus({ kind: 'drawing', done: 0, total: pages.length });
    const result = await rasterize(f, baseName(f.name), {
      dpi: raster.dpi,
      format: raster.format,
      pages,
      signal,
      onProgress: (done, total) => setStatus({ kind: 'drawing', done, total }),
    });
    setExcluded(new Set());
    track({ name: 'extraer-imagenes', mode: 'paginas' });
    setStatus({ kind: 'ready', mode: 'pages', images: pagesToExtracted(result), skipped: 0 });
  }

  async function extract() {
    if (!file) return;
    const controller = new AbortController();
    abortRef.current = controller;
    if (pagesMode) {
      try {
        await extractPages(file, controller.signal);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError')
          setStatus({ kind: 'cancelled' });
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
      return;
    }
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
      track({ name: 'extraer-imagenes', mode: 'imagenes' });
      setStatus({ kind: 'ready', mode: 'images', images: result, skipped: analysis.skipped });
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

  const resultMode = status.kind === 'ready' ? status.mode : mode;

  async function download() {
    if (!file) return;
    const name = baseName(file.name);
    downloadBlob(
      await zip(chosen),
      t(resultMode === 'pages' ? 'extract.zipNamePages' : 'extract.zipName', { name }),
    );
  }

  async function sendTo(target: 'cards' | 'split') {
    const selection = chosen;
    setStatus({ kind: 'preparing' });
    const loaded = await toImages(selection);
    if (target === 'cards') {
      useCardsStore.getState().addImages(loaded);
      navigate('/');
    } else {
      useSplitStore.getState().add(loaded);
      navigate('/split');
    }
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
        void open(e.dataTransfer.files[0]);
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
            void open(e.target.files?.[0]);
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
            <span className={styles.sourceTitle}>
              <span className={styles.name}>{file.name}</span>
              <span className={info.kind === 'unreadable' ? styles.error : styles.muted}>
                {info.kind === 'reading'
                  ? t('extract.reading')
                  : info.kind === 'unreadable'
                    ? t('extract.cantRead')
                    : t('extract.pages', { count: info.info.pages })}
              </span>
            </span>
            <div className={styles.settings}>
              <RadioGroup<ExtractMode>
                legend={t('extract.mode')}
                value={mode}
                onChange={changeMode}
                options={[
                  { value: 'images', label: t('extract.modeImages') },
                  { value: 'pages', label: t('extract.modePages') },
                ]}
              />
              {!pagesMode ? (
                <Checkbox
                  label={t('extract.ignoreSmall')}
                  hint={t('extract.ignoreSmallHint')}
                  checked={ignoreSmall}
                  onChange={setIgnoreSmall}
                />
              ) : info.kind === 'ready' ? (
                <div className={styles.options}>
                  <p className={styles.hint}>{t('extract.pagesHint')}</p>
                  <RasterFields settings={raster} pageCount={info.info.pages} />
                </div>
              ) : null}
            </div>
            <div className={styles.sourceActions}>
              <button
                type="button"
                className={styles.secondary}
                disabled={running}
                onClick={() => inputRef.current?.click()}
              >
                {t('extract.change')}
              </button>
              {working ? (
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
                  disabled={running || !canExtract}
                  onClick={() => void extract()}
                >
                  {t(pagesMode ? 'extract.extractPages' : 'extract.extract')}
                </button>
              )}
            </div>
          </div>
        )}

        <div aria-live="polite" className={styles.status}>
          {working ? (
            <>
              <progress max={status.total || 1} value={status.done} className={styles.progress} />
              <span>
                {t(`extract.${status.kind}`, {
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
                {status.mode === 'pages'
                  ? t('extract.pagesFound', { count: images.length })
                  : images.length === 0
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
              <span>
                {t(resultMode === 'pages' ? 'extract.pagesSelected' : 'extract.selected', {
                  count: chosen.length,
                })}
              </span>
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
                  className={styles.secondary}
                  disabled={chosen.length === 0 || running}
                  onClick={() => void sendTo('split')}
                >
                  {t('extract.toSplit')}
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={chosen.length === 0 || running}
                  onClick={() => void sendTo('cards')}
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
