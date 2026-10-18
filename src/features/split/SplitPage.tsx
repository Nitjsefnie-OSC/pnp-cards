import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { downloadUrl } from '../../components/download';
import { NumberField } from '../../components/form/NumberField';
import { Checkbox } from '../../components/form/Fields';
import { formatSize } from '../../components/formatSize';
import { splitGrid, detectBorder } from '../../lib/split';
import { pxToMm } from '../../lib/units';
import { useCardsStore, type NewImage } from '../../store/cardsStore';
import { splitImages as defaultSplit, type SplitImages } from '../../workers/pdfClient';
import {
  loadImage,
  loadImages as defaultLoadImages,
  looseFiles,
  type LoadResult,
} from '../cards/loadImages';
import type { FolderFile } from '../../lib/imageMatch';
import { RegionEditor } from './RegionEditor';
import { useSplitStore, type SplitItem } from './splitStore';
import styles from './SplitPage.module.css';

type Status =
  | { kind: 'idle' }
  | { kind: 'running'; done: number; total: number }
  | { kind: 'ready'; url: string; zip: Uint8Array; parts: number }
  | { kind: 'adding' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

/** Sin ppp en la imagen, las partes se guardan a 300 (como hacía PDFCartas). */
const DEFAULT_DPI = 300;
const dpiOf = (image: NewImage) => image.dpi?.x ?? DEFAULT_DPI;
const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');

/** Zona con contenido de la imagen: sin el margen uniforme que la rodea. */
async function findContent(image: NewImage) {
  const bitmap = await createImageBitmap(image.blob!);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0);
    return detectBorder(ctx.getImageData(0, 0, bitmap.width, bitmap.height));
  } finally {
    bitmap.close();
  }
}

/** Las partes del ZIP pasan a la lista de cartas. */
async function partsToCards(zipBytes: Uint8Array) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(zipBytes);
  const images: NewImage[] = [];
  for (const entry of Object.values(zip.files).filter((f) => !f.dir)) {
    const blob = await entry.async('blob');
    images.push(await loadImage(new File([blob], entry.name, { type: 'image/png' })));
  }
  return images;
}

function PartInfo({ item }: { item: SplitItem }) {
  const { t, i18n } = useTranslation();
  const parts = splitGrid(item.region, item.columns, item.rows);
  const w = Math.min(...parts.map((p) => p.width));
  const h = Math.min(...parts.map((p) => p.height));
  const uneven = parts.some((p) => p.width !== w || p.height !== h);
  const dpi = dpiOf(item.image);
  const mm = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 });
  const values = { w, h, wmm: mm.format(pxToMm(w, dpi)), hmm: mm.format(pxToMm(h, dpi)) };
  return (
    <p className={styles.info}>{t(uneven ? 'split.partSizeUneven' : 'split.partSize', values)}</p>
  );
}

export function SplitPage({
  loadImages = defaultLoadImages,
  split = defaultSplit,
  toCards = partsToCards,
  contentOf = findContent,
}: {
  loadImages?: (entries: FolderFile[]) => Promise<LoadResult>;
  split?: SplitImages;
  toCards?: (zip: Uint8Array) => Promise<NewImage[]>;
  contentOf?: (image: NewImage) => Promise<{ x: number; y: number; width: number; height: number }>;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { items, selectedId, sameForAll } = useSplitStore();
  const actions = useSplitStore.getState();
  const selected = items.find((i) => i.id === selectedId) ?? items[0];
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [loading, setLoading] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [dropping, setDropping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const readyUrl = status.kind === 'ready' ? status.url : null;

  useEffect(() => {
    return () => {
      if (readyUrl) URL.revokeObjectURL(readyUrl);
    };
  }, [readyUrl]);

  // Cambiar la lista o los ajustes invalida el ZIP anterior.
  useEffect(() => {
    return useSplitStore.subscribe((s, prev) => {
      if (s.items !== prev.items) setStatus((st) => (st.kind === 'ready' ? { kind: 'idle' } : st));
    });
  }, []);

  async function add(files: File[]) {
    if (files.length === 0) return;
    setLoading(files.length);
    setFailed([]);
    try {
      const result = await loadImages(looseFiles(files));
      actions.add(result.images);
      setFailed(result.failed);
    } finally {
      setLoading(0);
    }
  }

  async function run() {
    const controller = new AbortController();
    abortRef.current = controller;
    const total = items.reduce((n, i) => n + i.columns * i.rows, 0);
    setStatus({ kind: 'running', done: 0, total });
    try {
      const zip = await split(
        items.map((i) => ({
          name: i.image.name,
          blob: i.image.blob!,
          region: i.region,
          columns: i.columns,
          rows: i.rows,
          dpi: dpiOf(i.image),
        })),
        {
          signal: controller.signal,
          onProgress: (done, all) => setStatus({ kind: 'running', done, total: all }),
        },
      );
      const url = URL.createObjectURL(
        new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }),
      );
      downloadUrl(url, t('split.fileName'));
      setStatus({ kind: 'ready', url, zip, parts: total });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError')
        setStatus({ kind: 'cancelled' });
      else
        setStatus({
          kind: 'error',
          message: t('split.errorUnknown', {
            message: err instanceof Error ? err.message : String(err),
          }),
        });
    } finally {
      abortRef.current = null;
    }
  }

  async function addToCards(zip: Uint8Array) {
    setStatus({ kind: 'adding' });
    useCardsStore.getState().addImages(await toCards(zip));
    navigate('/');
  }

  const totalParts = items.reduce((n, i) => n + i.columns * i.rows, 0);
  const running = status.kind === 'running' || status.kind === 'adding';

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
        void add([...e.dataTransfer.files]);
      }}
    >
      <header className={styles.header}>
        <h1>{t('split.title')}</h1>
        <p>{t('split.intro')}</p>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.primary}
            disabled={running || loading > 0}
            onClick={() => inputRef.current?.click()}
          >
            {t('split.add')}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.tif,.tiff"
            multiple
            hidden
            data-testid="split-input"
            onChange={(e) => {
              void add([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
          {items.length > 0 ? (
            <button
              type="button"
              className={styles.link}
              disabled={running}
              onClick={() => {
                if (window.confirm(t('split.clearConfirm'))) actions.clear();
              }}
            >
              {t('split.clear')}
            </button>
          ) : null}
          {loading > 0 ? <span role="status">{t('split.loading', { count: loading })}</span> : null}
          {failed.length > 0 ? (
            <span className={styles.error} role="alert">
              {t('split.failed', { names: failed.join(', ') })}
            </span>
          ) : null}
        </div>
      </header>

      {!selected ? (
        <div className={styles.empty}>
          <p>{t('split.empty')}</p>
        </div>
      ) : (
        <div className={styles.workspace}>
          <aside className={styles.list} aria-label={t('split.images')}>
            <ul>
              {items.map((item) => (
                <li key={item.id} data-selected={item.id === selected.id || undefined}>
                  <button
                    type="button"
                    className={styles.pick}
                    aria-label={t('split.select', { name: item.image.name })}
                    aria-current={item.id === selected.id || undefined}
                    onClick={() => actions.select(item.id)}
                  >
                    {item.image.thumbUrl ? (
                      <img src={item.image.thumbUrl} alt="" loading="lazy" />
                    ) : null}
                    <span className={styles.pickText}>
                      <span className={styles.pickName}>{item.image.name}</span>
                      <span className={styles.muted}>
                        {t('split.parts', { count: item.columns * item.rows })}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={t('split.remove', { name: item.image.name })}
                    onClick={() => actions.remove(item.id)}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <RegionEditor
            image={selected.image}
            region={selected.region}
            columns={selected.columns}
            rows={selected.rows}
            onChange={(region) => actions.update(selected.id, { region })}
          />

          <div className={styles.fields}>
            <p className={styles.info}>
              {t('split.imageInfo', {
                w: selected.image.widthPx,
                h: selected.image.heightPx,
                dpi: dpiOf(selected.image),
              })}
            </p>
            <fieldset>
              <legend>{t('split.grid')}</legend>
              <NumberField
                label={t('split.columns')}
                value={selected.columns}
                min={1}
                max={30}
                integer
                onChange={(columns) => actions.update(selected.id, { columns })}
              />
              <NumberField
                label={t('split.rows')}
                value={selected.rows}
                min={1}
                max={30}
                integer
                onChange={(rows) => actions.update(selected.id, { rows })}
              />
            </fieldset>
            <fieldset>
              <legend>{t('split.region')}</legend>
              {(['x', 'y', 'width', 'height'] as const).map((key) => (
                <NumberField
                  key={key}
                  label={t(`split.${key}`)}
                  value={selected.region[key]}
                  min={key === 'x' || key === 'y' ? 0 : 1}
                  integer
                  unit={t('split.px')}
                  onChange={(v) =>
                    actions.update(selected.id, { region: { ...selected.region, [key]: v } })
                  }
                />
              ))}
              <div className={styles.buttons}>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() =>
                    void contentOf(selected.image).then((region) =>
                      actions.update(selected.id, { region }),
                    )
                  }
                >
                  {t('split.detect')}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() =>
                    actions.update(selected.id, {
                      region: {
                        x: 0,
                        y: 0,
                        width: selected.image.widthPx,
                        height: selected.image.heightPx,
                      },
                    })
                  }
                >
                  {t('split.whole')}
                </button>
              </div>
            </fieldset>
            <PartInfo item={selected} />
            {items.length > 1 ? (
              <Checkbox
                label={t('split.sameForAll')}
                checked={sameForAll}
                onChange={actions.setSameForAll}
              />
            ) : null}
          </div>
        </div>
      )}

      {items.length > 0 ? (
        <div className={styles.footer}>
          <div className={styles.summary} aria-live="polite">
            {status.kind === 'running' ? (
              <>
                <progress max={status.total} value={status.done} className={styles.progress} />
                <span>{t('split.splitting', { done: status.done, total: status.total })}</span>
              </>
            ) : status.kind === 'ready' ? (
              <>
                <span>
                  {t('split.ready', {
                    parts: t('split.parts', { count: status.parts }),
                    size: formatSize(status.zip.byteLength, i18n.resolvedLanguage),
                  })}
                </span>
                <span className={styles.links}>
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => downloadUrl(status.url, t('split.fileName'))}
                  >
                    {t('split.downloadAgain')}
                  </button>
                </span>
              </>
            ) : status.kind === 'adding' ? (
              <span>{t('split.adding')}</span>
            ) : status.kind === 'cancelled' ? (
              <span>{t('split.cancelled')}</span>
            ) : status.kind === 'error' ? (
              <span role="alert" className={styles.error}>
                {status.message}
              </span>
            ) : null}
          </div>
          {status.kind === 'running' ? (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => abortRef.current?.abort()}
            >
              {t('split.cancel')}
            </button>
          ) : status.kind === 'ready' ? (
            <button
              type="button"
              className={styles.primary}
              onClick={() => void addToCards(status.zip)}
            >
              {t('split.addToCards')}
            </button>
          ) : (
            <button
              type="button"
              className={styles.primary}
              disabled={running}
              onClick={() => void run()}
            >
              {t('split.split', { count: totalParts })}
            </button>
          )}
        </div>
      ) : null}

      {dropping ? (
        <div className={styles.dropOverlay} aria-hidden="true">
          {t('split.dropHere')}
        </div>
      ) : null}
    </div>
  );
}
