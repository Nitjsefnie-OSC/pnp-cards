import { memo, useEffect, useRef, useState, type DragEvent } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { confirmAction } from '../../components/confirmAction';
import { downloadUrl } from '../../components/download';
import { formatSize } from '../../components/formatSize';
import { inspectPdf, type PdfInfo } from '../../pdf/pdfjs';
import { mergePdfs, TaskError, type MergePdfs } from '../../workers/pdfClient';
import styles from './MergePage.module.css';

interface PdfItem {
  id: string;
  file: File;
  /** null mientras se lee. */
  info: PdfInfo | null;
  unreadable: boolean;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'running'; done: number; total: number }
  | { kind: 'ready'; url: string; bytes: number; pages: number }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');

const PdfRow = memo(function PdfRow({
  item,
  onRemove,
}: {
  item: PdfItem;
  onRemove: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const name = item.file.name;

  return (
    <li
      ref={setNodeRef}
      className={styles.row}
      data-dragging={isDragging || undefined}
      data-error={item.unreadable || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.handle}
        aria-label={t('merge.drag', { name })}
        {...attributes}
        {...listeners}
      >
        <svg viewBox="0 0 10 16" aria-hidden="true">
          <circle cx="2.5" cy="3" r="1.3" />
          <circle cx="7.5" cy="3" r="1.3" />
          <circle cx="2.5" cy="8" r="1.3" />
          <circle cx="7.5" cy="8" r="1.3" />
          <circle cx="2.5" cy="13" r="1.3" />
          <circle cx="7.5" cy="13" r="1.3" />
        </svg>
      </button>
      <span className={styles.thumb}>
        {item.info?.thumbUrl ? <img src={item.info.thumbUrl} alt="" loading="lazy" /> : null}
      </span>
      <span className={styles.text}>
        <span className={styles.name} title={name}>
          {name}
        </span>
        <span className={item.unreadable ? styles.error : styles.meta}>
          {item.unreadable
            ? t('merge.unreadable')
            : item.info
              ? t('merge.meta', {
                  pages: t('merge.pages', { count: item.info.pages }),
                  size: formatSize(item.file.size, i18n.resolvedLanguage),
                })
              : t('merge.reading')}
        </span>
      </span>
      <button
        type="button"
        className={styles.remove}
        aria-label={t('merge.remove', { name })}
        title={t('merge.remove', { name })}
        onClick={() => onRemove(item.id)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </li>
  );
});

export function MergePage({
  inspect = inspectPdf,
  merge = mergePdfs,
}: {
  inspect?: (file: Blob) => Promise<PdfInfo>;
  merge?: MergePdfs;
}) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<PdfItem[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [notPdf, setNotPdf] = useState<string[]>([]);
  const [dropping, setDropping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const readyUrl = status.kind === 'ready' ? status.url : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    return () => {
      if (readyUrl) URL.revokeObjectURL(readyUrl);
    };
  }, [readyUrl]);

  /** Cambia la lista; el PDF unido antes, si lo había, deja de corresponder a ella. */
  function changeList(update: (prev: PdfItem[]) => PdfItem[]) {
    setItems(update);
    setStatus((s) => (s.kind === 'running' ? s : { kind: 'idle' }));
  }

  async function add(files: File[]) {
    const pdfs = files.filter(isPdf);
    setNotPdf(files.filter((f) => !isPdf(f)).map((f) => f.name));
    const added = pdfs.map((file) => ({
      id: crypto.randomUUID(),
      file,
      info: null,
      unreadable: false,
    }));
    changeList((prev) => [...prev, ...added]);
    // De uno en uno: pdf.js con muchos PDF a la vez gasta mucha memoria.
    for (const item of added) {
      let update: Partial<PdfItem>;
      try {
        update = { info: await inspect(item.file) };
      } catch {
        update = { unreadable: true };
      }
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...update } : i)));
    }
  }

  function remove(id: string) {
    changeList((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.info?.thumbUrl) URL.revokeObjectURL(item.info.thumbUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  async function clear() {
    const ok = await confirmAction({
      title: t('merge.clearTitle'),
      confirmLabel: t('merge.clear'),
      danger: true,
    });
    if (!ok) return;
    for (const i of items) if (i.info?.thumbUrl) URL.revokeObjectURL(i.info.thumbUrl);
    setItems([]);
    setStatus({ kind: 'idle' });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    changeList((prev) => {
      const from = prev.findIndex((i) => i.id === active.id);
      const to = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, from, to);
    });
  }

  async function run() {
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ kind: 'running', done: 0, total: items.length });
    try {
      const sources = await Promise.all(
        items.map(async (i) => ({ name: i.file.name, data: await i.file.arrayBuffer() })),
      );
      const result = await merge(sources, {
        signal: controller.signal,
        onProgress: (done, total) => setStatus({ kind: 'running', done, total }),
      });
      const url = URL.createObjectURL(
        new Blob([result as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      );
      downloadUrl(url, t('merge.fileName'));
      setStatus({ kind: 'ready', url, bytes: result.byteLength, pages: totalPages });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus({ kind: 'cancelled' });
      } else if (err instanceof TaskError && err.code === 'unreadable') {
        setStatus({ kind: 'error', message: t('merge.errorUnreadable', { name: err.detail }) });
      } else {
        setStatus({
          kind: 'error',
          message: t('merge.errorUnknown', {
            message: err instanceof Error ? err.message : String(err),
          }),
        });
      }
    } finally {
      abortRef.current = null;
    }
  }

  const totalPages = items.reduce((n, i) => n + (i.info?.pages ?? 0), 0);
  const allRead = items.every((i) => i.info);
  const canMerge = items.length >= 2 && allRead;
  const running = status.kind === 'running';

  return (
    <div
      className={styles.page}
      data-dropping={dropping || undefined}
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
      <div className={styles.column}>
        <header className={styles.header}>
          <h1>{t('merge.title')}</h1>
          <p>{t('merge.intro')}</p>
        </header>

        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.primary}
            disabled={running}
            onClick={() => inputRef.current?.click()}
          >
            {t('merge.add')}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            data-testid="pdf-input"
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
              onClick={() => void clear()}
            >
              {t('merge.clear')}
            </button>
          ) : null}
        </div>

        {notPdf.length > 0 ? (
          <p className={styles.error} role="status">
            {t('merge.notPdf', { count: notPdf.length, names: notPdf.join(', ') })}
          </p>
        ) : null}

        {items.length === 0 ? (
          <div className={styles.empty}>
            <p>{t('merge.empty')}</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ol className={styles.list}>
                {items.map((item) => (
                  <PdfRow key={item.id} item={item} onRemove={remove} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        {items.length > 0 ? (
          <div className={styles.footer}>
            <div className={styles.summary} aria-live="polite">
              {status.kind === 'running' ? (
                <>
                  <progress max={status.total} value={status.done} className={styles.progress} />
                  <span>{t('merge.merging', { done: status.done, total: status.total })}</span>
                </>
              ) : status.kind === 'ready' ? (
                <>
                  <span>
                    {t('merge.ready', {
                      pages: t('merge.pages', { count: status.pages }),
                      size: formatSize(status.bytes, i18n.resolvedLanguage),
                    })}
                  </span>
                  <span className={styles.links}>
                    <button
                      type="button"
                      className={styles.link}
                      onClick={() => downloadUrl(status.url, t('merge.fileName'))}
                    >
                      {t('merge.downloadAgain')}
                    </button>
                    <a href={status.url} target="_blank" rel="noopener">
                      {t('merge.open')}
                    </a>
                  </span>
                </>
              ) : status.kind === 'cancelled' ? (
                <span>{t('merge.cancelled')}</span>
              ) : status.kind === 'error' ? (
                <span role="alert" className={styles.error}>
                  {status.message}
                </span>
              ) : items.length < 2 ? (
                <span>{t('merge.needTwo')}</span>
              ) : (
                <span className={styles.total}>{t('merge.total', { count: totalPages })}</span>
              )}
            </div>
            {running ? (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => abortRef.current?.abort()}
              >
                {t('merge.cancel')}
              </button>
            ) : (
              <button
                type="button"
                className={styles.primary}
                disabled={!canMerge || items.some((i) => i.unreadable)}
                onClick={() => void run()}
              >
                {t('merge.merge')}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {dropping ? (
        <div className={styles.dropOverlay} aria-hidden="true">
          {t('merge.dropHere')}
        </div>
      ) : null}
    </div>
  );
}
