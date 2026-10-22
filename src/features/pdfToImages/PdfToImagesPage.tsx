import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { track } from '../../analytics/track';
import { useNavigate } from 'react-router-dom';
import { downloadUrl } from '../../components/download';
import { formatSize } from '../../components/formatSize';
import { zipFiles } from '../../components/zipFiles';
import { inspectPdf, type PdfInfo } from '../../pdf/pdfjs';
import { rasterizePdf, type PageImage, type RasterOptions } from '../../pdf/rasterize';
import { useCardsStore, type NewImage } from '../../store/cardsStore';
import { loadImage } from '../cards/loadImages';
import { useSplitStore } from '../split/splitStore';
import styles from './PdfToImagesPage.module.css';
import { RasterFields } from './RasterFields';
import { useRasterSettings } from './useRasterSettings';

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
  const [source, setSource] = useState<Source>({ kind: 'none' });
  const [notPdf, setNotPdf] = useState('');
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

  const info = source.kind === 'ready' ? source.info : null;
  const raster = useRasterSettings(info);
  const { pages } = raster;
  const running = status.kind === 'running' || status.kind === 'preparing';

  async function open(file: File | undefined) {
    if (!file) return;
    if (!isPdf(file)) {
      setNotPdf(t('pdfToImages.notPdf', { name: file.name }));
      return;
    }
    setNotPdf('');
    raster.setRange('');
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
        dpi: raster.dpi,
        format: raster.format,
        pages,
        signal: controller.signal,
        onProgress: (done, total) => setStatus({ kind: 'running', done, total }),
      });
      const blob = await zip(images);
      const url = URL.createObjectURL(blob);
      const zipName = t('pdfToImages.zipName', { name });
      downloadUrl(url, zipName);
      track({ name: 'pdf-a-imagenes' });
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
            <RasterFields settings={raster} pageCount={info.pages} onChange={resetResult} />
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
