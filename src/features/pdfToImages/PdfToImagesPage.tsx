import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { downloadUrl } from '../../components/download';
import { RadioGroup } from '../../components/form/Fields';
import { NumberField } from '../../components/form/NumberField';
import { formatSize } from '../../components/formatSize';
import { zipFiles } from '../../components/zipFiles';
import { pagePixels, parsePageRange } from '../../lib/pageRange';
import { inspectPdf, type PdfInfo } from '../../pdf/pdfjs';
import {
  rasterizePdf,
  type PageImage,
  type RasterFormat,
  type RasterOptions,
} from '../../pdf/rasterize';
import { useCardsStore, type NewImage } from '../../store/cardsStore';
import { loadImage } from '../cards/loadImages';
import { useSplitStore } from '../split/splitStore';
import styles from './PdfToImagesPage.module.css';

type Source =
  | { kind: 'none' }
  | { kind: 'reading'; file: File }
  | { kind: 'ready'; file: File; info: PdfInfo }
  | { kind: 'unreadable'; file: File };

type Status =
  | { kind: 'idle' }
  | { kind: 'running'; done: number; total: number }
  | { kind: 'ready'; images: PageImage[]; url: string; zipName: string; bytes: number }
  | { kind: 'preparing' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

const PRESETS = [150, 300, 600];
/** Por encima de esto (píxeles por página) el navegador puede quedarse sin memoria. */
const BIG_PAGE = 40e6;

const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
const baseName = (name: string) => name.replace(/\.[^.]+$/, '');
const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');

/** Las imágenes convertidas, listas para Cartas o Dividir (de una en una). */
async function pagesToImages(pages: PageImage[]) {
  const images: NewImage[] = [];
  for (const p of pages)
    images.push(await loadImage(new File([p.blob], p.name, { type: p.blob.type })));
  return images;
}

export function PdfToImagesPage({
  inspect = inspectPdf,
  rasterize = rasterizePdf,
  zip = zipFiles,
  toImages = pagesToImages,
}: {
  inspect?: (file: Blob) => Promise<PdfInfo>;
  rasterize?: (file: Blob, baseName: string, options: RasterOptions) => Promise<PageImage[]>;
  zip?: (files: PageImage[]) => Promise<Blob>;
  toImages?: (pages: PageImage[]) => Promise<NewImage[]>;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const rangeId = useId();
  const [source, setSource] = useState<Source>({ kind: 'none' });
  const [notPdf, setNotPdf] = useState('');
  const [format, setFormat] = useState<RasterFormat>('jpeg');
  const [preset, setPreset] = useState<string>('300');
  const [customDpi, setCustomDpi] = useState(400);
  const [range, setRange] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [dropping, setDropping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const readyUrl = status.kind === 'ready' ? status.url : null;

  useEffect(() => {
    return () => {
      if (readyUrl) URL.revokeObjectURL(readyUrl);
    };
  }, [readyUrl]);

  const dpi = preset === 'custom' ? customDpi : Number(preset);
  const info = source.kind === 'ready' ? source.info : null;
  const pages = info ? parsePageRange(range, info.pages) : null;
  const size = info?.firstPage ? pagePixels(info.firstPage, dpi) : null;
  const running = status.kind === 'running' || status.kind === 'preparing';

  async function open(file: File | undefined) {
    if (!file) return;
    if (!isPdf(file)) {
      setNotPdf(t('pdfToImages.notPdf', { name: file.name }));
      return;
    }
    setNotPdf('');
    setRange('');
    setStatus({ kind: 'idle' });
    if (source.kind === 'ready' && source.info.thumbUrl) URL.revokeObjectURL(source.info.thumbUrl);
    setSource({ kind: 'reading', file });
    try {
      setSource({ kind: 'ready', file, info: await inspect(file) });
    } catch {
      setSource({ kind: 'unreadable', file });
    }
  }

  async function convert() {
    if (source.kind !== 'ready' || !pages) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ kind: 'running', done: 0, total: pages.length });
    try {
      const name = baseName(source.file.name);
      const images = await rasterize(source.file, name, {
        dpi,
        format,
        pages,
        signal: controller.signal,
        onProgress: (done, total) => setStatus({ kind: 'running', done, total }),
      });
      const blob = await zip(images);
      const url = URL.createObjectURL(blob);
      const zipName = t('pdfToImages.zipName', { name });
      downloadUrl(url, zipName);
      setStatus({ kind: 'ready', images, url, zipName, bytes: blob.size });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError')
        setStatus({ kind: 'cancelled' });
      else
        setStatus({
          kind: 'error',
          message: t('pdfToImages.errorUnknown', {
            message: err instanceof Error ? err.message : String(err),
          }),
        });
    } finally {
      abortRef.current = null;
    }
  }

  async function sendTo(target: 'cards' | 'split', images: PageImage[]) {
    setStatus({ kind: 'preparing' });
    const loaded = await toImages(images);
    if (target === 'cards') {
      useCardsStore.getState().addImages(loaded);
      navigate('/');
    } else {
      useSplitStore.getState().add(loaded);
      navigate('/split');
    }
  }

  // Cambiar los ajustes invalida el resultado anterior.
  const resetResult = () => setStatus((s) => (s.kind === 'ready' ? { kind: 'idle' } : s));

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
          <h1>{t('pdfToImages.title')}</h1>
          <p>{t('pdfToImages.intro')}</p>
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

        {source.kind === 'none' ? (
          <div className={styles.empty}>
            <p>{t('pdfToImages.empty')}</p>
            <button
              type="button"
              className={styles.primary}
              onClick={() => inputRef.current?.click()}
            >
              {t('pdfToImages.choose')}
            </button>
          </div>
        ) : (
          <div className={styles.source}>
            <span className={styles.thumb}>
              {info?.thumbUrl ? <img src={info.thumbUrl} alt="" /> : null}
            </span>
            <span className={styles.sourceText}>
              <span className={styles.name}>{source.file.name}</span>
              <span className={source.kind === 'unreadable' ? styles.error : styles.muted}>
                {source.kind === 'reading'
                  ? t('pdfToImages.reading')
                  : source.kind === 'unreadable'
                    ? t('pdfToImages.unreadable', { name: source.file.name })
                    : t('pdfToImages.pages', { count: source.info.pages })}
              </span>
            </span>
            <button
              type="button"
              className={styles.secondary}
              disabled={running}
              onClick={() => inputRef.current?.click()}
            >
              {t('pdfToImages.change')}
            </button>
          </div>
        )}

        {info ? (
          <div className={styles.options}>
            <RadioGroup<RasterFormat>
              legend={t('pdfToImages.format')}
              value={format}
              onChange={(f) => {
                setFormat(f);
                resetResult();
              }}
              options={[
                { value: 'jpeg', label: t('pdfToImages.jpeg') },
                { value: 'png', label: t('pdfToImages.png') },
              ]}
            />

            <fieldset className={styles.dpi}>
              <legend>{t('pdfToImages.resolution')}</legend>
              <div className={styles.segmented}>
                {[...PRESETS.map(String), 'custom'].map((value) => (
                  <label key={value} data-checked={preset === value || undefined}>
                    <input
                      type="radio"
                      name="dpi"
                      value={value}
                      checked={preset === value}
                      onChange={() => {
                        setPreset(value);
                        resetResult();
                      }}
                    />
                    {value === 'custom' ? t('pdfToImages.custom') : value}
                  </label>
                ))}
                <span className={styles.unit}>{t('pdfToImages.dpi')}</span>
              </div>
              {preset === 'custom' ? (
                <NumberField
                  label={t('pdfToImages.resolution')}
                  value={customDpi}
                  min={36}
                  max={1200}
                  integer
                  unit={t('pdfToImages.dpi')}
                  onChange={(v) => {
                    setCustomDpi(v);
                    resetResult();
                  }}
                />
              ) : null}
            </fieldset>

            <div className={styles.range}>
              <label htmlFor={rangeId}>{t('pdfToImages.range')}</label>
              <input
                id={rangeId}
                value={range}
                placeholder={t('pdfToImages.rangeHint')}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={pages === null || undefined}
                onChange={(e) => {
                  setRange(e.target.value);
                  resetResult();
                }}
              />
              {pages === null ? (
                <p className={styles.error}>
                  {t('pdfToImages.rangeInvalid', { count: info.pages })}
                </p>
              ) : null}
            </div>

            {size ? (
              <p className={styles.info}>
                {t('pdfToImages.size', { w: size.width, h: size.height })}
                {size.width * size.height > BIG_PAGE ? (
                  <span className={styles.warning}> {t('pdfToImages.big')}</span>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        {info ? (
          <div className={styles.footer}>
            <div className={styles.summary} aria-live="polite">
              {status.kind === 'running' ? (
                <>
                  <progress max={status.total} value={status.done} className={styles.progress} />
                  <span>
                    {t('pdfToImages.converting', { done: status.done, total: status.total })}
                  </span>
                </>
              ) : status.kind === 'ready' ? (
                <>
                  <span>
                    {t('pdfToImages.ready', {
                      images: t('pdfToImages.images', { count: status.images.length }),
                      size: formatSize(status.bytes, i18n.resolvedLanguage),
                    })}
                  </span>
                  <span className={styles.links}>
                    <button
                      type="button"
                      className={styles.link}
                      onClick={() => downloadUrl(status.url, status.zipName)}
                    >
                      {t('pdfToImages.downloadAgain')}
                    </button>
                  </span>
                </>
              ) : status.kind === 'preparing' ? (
                <span>{t('pdfToImages.preparing')}</span>
              ) : status.kind === 'cancelled' ? (
                <span>{t('pdfToImages.cancelled')}</span>
              ) : status.kind === 'error' ? (
                <span className={styles.error} role="alert">
                  {status.message}
                </span>
              ) : null}
            </div>
            <div className={styles.actions}>
              {status.kind === 'running' ? (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => abortRef.current?.abort()}
                >
                  {t('pdfToImages.cancel')}
                </button>
              ) : status.kind === 'ready' ? (
                <>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => void sendTo('split', status.images)}
                  >
                    {t('pdfToImages.toSplit')}
                  </button>
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={() => void sendTo('cards', status.images)}
                  >
                    {t('pdfToImages.addToCards')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.primary}
                  disabled={!pages || running}
                  onClick={() => void convert()}
                >
                  {t('pdfToImages.convert', { count: pages?.length ?? info.pages })}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {dropping ? (
        <div className={styles.dropOverlay} aria-hidden="true">
          {t('pdfToImages.dropHere')}
        </div>
      ) : null}
    </div>
  );
}
