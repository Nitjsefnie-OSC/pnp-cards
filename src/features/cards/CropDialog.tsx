import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '../../components/form/Fields';
import { NumberField } from '../../components/form/NumberField';
import { cropRect, CROP_DPI } from '../../lib/crop';
import type { CropSettings } from '../../lib/settings';
import { pxToMm } from '../../lib/units';
import { useCardsStore } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';
import styles from './CropDialog.module.css';

/** URL temporal de la imagen a tamaño completo, liberada al cambiar de imagen o cerrar. */
function useObjectUrl(blob: Blob | null) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}

export function CropDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const mmFormat = new Intl.NumberFormat(i18n.resolvedLanguage, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const mm = (px: number) => mmFormat.format(pxToMm(px, CROP_DPI));
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const selectId = useId();

  const cards = useCardsStore((s) => s.cards);
  const images = useMemo(() => cards.filter((c) => c.blob), [cards]);
  const crop = useSettingsStore((s) => s.settings.crop);
  const update = useSettingsStore((s) => s.update);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const card = images.find((c) => c.id === selectedId) ?? images[0];
  const url = useObjectUrl(open && card ? card.blob : null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  const setCrop = (patch: Partial<CropSettings>) => update({ crop: { ...crop, ...patch } });
  const rect = card ? cropRect(card, { ...crop, enabled: true }) : null;

  /** Mueve el recorte a una posición fija (deja de estar centrado). */
  function moveTo(x: number, y: number) {
    if (!card || !rect) return;
    setCrop({
      centered: false,
      x: Math.round(Math.min(Math.max(0, x), card.widthPx - rect.width)),
      y: Math.round(Math.min(Math.max(0, y), card.heightPx - rect.height)),
    });
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, x: rect.x, y: rect.y };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!drag.current || !stage || !card) return;
    const scale = card.widthPx / stage.getBoundingClientRect().width;
    moveTo(
      drag.current.x + (e.clientX - drag.current.startX) * scale,
      drag.current.y + (e.clientY - drag.current.startY) * scale,
    );
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!rect) return;
    const step = e.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    moveTo(rect.x + move[0], rect.y + move[1]);
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      aria-labelledby={`${selectId}-title`}
    >
      <div className={styles.header}>
        <h2 id={`${selectId}-title`}>{t('crop.title')}</h2>
        <button type="button" className={styles.done} onClick={onClose}>
          {t('crop.done')}
        </button>
      </div>

      {!card || !rect ? (
        <p className={styles.body}>{t('crop.noImages')}</p>
      ) : (
        <div className={styles.body}>
          <div className={styles.stageWrap}>
            <div
              ref={stageRef}
              className={styles.stage}
              style={
                {
                  aspectRatio: `${card.widthPx} / ${card.heightPx}`,
                  '--ratio': card.widthPx / card.heightPx,
                } as CSSProperties
              }
            >
              {url ? (
                <img
                  src={url}
                  alt=""
                  width={card.widthPx}
                  height={card.heightPx}
                  draggable={false}
                />
              ) : null}
              <div
                className={styles.rect}
                role="slider"
                tabIndex={0}
                aria-label={t('crop.area')}
                aria-valuetext={`X ${rect.x}, Y ${rect.y} px`}
                aria-valuenow={rect.x}
                style={{
                  left: `${(rect.x / card.widthPx) * 100}%`,
                  top: `${(rect.y / card.heightPx) * 100}%`,
                  width: `${(rect.width / card.widthPx) * 100}%`,
                  height: `${(rect.height / card.heightPx) * 100}%`,
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
                onKeyDown={onKeyDown}
              />
            </div>
            <p className={styles.hint}>{t('crop.hint')}</p>
          </div>

          <div className={styles.fields}>
            {images.length > 1 ? (
              <div className={styles.select}>
                <label htmlFor={selectId}>{t('crop.card')}</label>
                <select
                  id={selectId}
                  value={card.id}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {images.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <p className={styles.info}>
              {t('crop.imageInfo', {
                w: card.widthPx,
                h: card.heightPx,
                wmm: mm(card.widthPx),
                hmm: mm(card.heightPx),
              })}
            </p>
            <NumberField
              label={t('crop.width')}
              value={crop.widthMm}
              min={0}
              unit={t('settings.mm')}
              onChange={(widthMm) => setCrop({ widthMm })}
            />
            <NumberField
              label={t('crop.height')}
              value={crop.heightMm}
              min={0}
              unit={t('settings.mm')}
              onChange={(heightMm) => setCrop({ heightMm })}
            />
            <p className={styles.hint}>{t('crop.zeroHint')}</p>
            <Checkbox
              label={t('crop.centered')}
              checked={crop.centered}
              onChange={(centered) =>
                setCrop(centered ? { centered } : { centered, x: rect.x, y: rect.y })
              }
            />
            <NumberField
              label={t('crop.x')}
              value={crop.centered ? rect.x : crop.x}
              min={0}
              integer
              unit={t('crop.px')}
              disabled={crop.centered}
              onChange={(x) => setCrop({ x })}
            />
            <NumberField
              label={t('crop.y')}
              value={crop.centered ? rect.y : crop.y}
              min={0}
              integer
              unit={t('crop.px')}
              disabled={crop.centered}
              onChange={(y) => setCrop({ y })}
            />
            <p className={styles.info}>{t('crop.cropInfo', { w: rect.width, h: rect.height })}</p>
            {rect.clamped ? (
              <p className={styles.warning} role="status">
                {t('crop.clamped')}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </dialog>
  );
}
