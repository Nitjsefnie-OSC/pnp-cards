import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { formatSize } from '../../components/formatSize';
import { cardFit } from '../../lib/cardInfo';
import { useCardsStore, type CardImage } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';
import styles from './CardTile.module.css';

const FORMAT_NAMES: Record<string, string> = {
  jpeg: 'JPG',
  png: 'PNG',
  webp: 'WebP',
  tiff: 'TIFF',
  gif: 'GIF',
  bmp: 'BMP',
  avif: 'AVIF',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

/** Datos de la carta en un panel junto a ella: formato, píxeles, ppp, tamaño y cómo sale en el PDF. */
function InfoContent({
  card,
  name,
  position,
  total,
}: {
  card: CardImage;
  name: string;
  position: number;
  total: number;
}) {
  const { t, i18n } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const mm = new Intl.NumberFormat(i18n.resolvedLanguage, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const size = (m: { width: number; height: number }) =>
    t('cardInfo.mmValue', { w: mm.format(m.width), h: mm.format(m.height) });

  if (!card.blob && !card.missing) return <p>{t('cardInfo.blank')}</p>;

  const fit = card.blob ? cardFit(card, settings) : null;
  const format = card.sourceFormat
    ? (FORMAT_NAMES[card.sourceFormat] ?? card.sourceFormat.toUpperCase())
    : null;
  const converted = card.sourceFormat && card.sourceFormat !== card.format;

  return (
    <>
      {card.missing ? <p className={styles.infoWarning}>{t('cardInfo.missing')}</p> : null}
      <dl className={styles.infoList}>
        <Row label={t('cardInfo.file')}>{name}</Row>
        {card.path && card.path !== card.name ? (
          <Row label={t('cardInfo.path')}>{card.path}</Row>
        ) : null}
        {format ? (
          <Row label={t('cardInfo.format')}>
            {converted ? t('cardInfo.converted', { format }) : format}
          </Row>
        ) : null}
        {fit ? (
          <>
            <Row label={t('cardInfo.pixels')}>
              {t('cardInfo.pixelsValue', { w: card.widthPx, h: card.heightPx })}
            </Row>
            <Row label={t('cardInfo.resolution')}>
              {card.dpi ? (
                t('cardInfo.dpiValue', { dpi: card.dpi.x })
              ) : (
                <span className={styles.infoWarning}>{t('cardInfo.noDpi')}</span>
              )}
            </Row>
            <Row label={t('cardInfo.physical')}>{size(fit.physicalMm)}</Row>
            <Row label={t('cardInfo.pdf')}>
              {fit.result.kind === 'same'
                ? t('cardInfo.same')
                : fit.result.kind === 'scaled'
                  ? t('cardInfo.scaled', {
                      w: mm.format(fit.result.printedMm.width),
                      h: mm.format(fit.result.printedMm.height),
                      percent: fit.result.percent,
                    })
                  : fit.result.kind === 'distorted'
                    ? t('cardInfo.distorted', {
                        w: mm.format(fit.result.printedMm.width),
                        h: mm.format(fit.result.printedMm.height),
                        px: fit.result.percentX,
                        py: fit.result.percentY,
                      })
                    : fit.result.kind === 'cropped'
                      ? t('cardInfo.cropped', {
                          w: mm.format(fit.result.cropMm.width),
                          h: mm.format(fit.result.cropMm.height),
                        })
                      : t('cardInfo.slot')}
            </Row>
          </>
        ) : null}
        {card.fileBytes ? (
          <Row label={t('cardInfo.weight')}>
            {formatSize(card.fileBytes, i18n.resolvedLanguage)}
          </Row>
        ) : null}
        <Row label={t('cardInfo.copies')}>{card.copies}</Row>
      </dl>
      {settings.backs.enabled ? (
        <label className={styles.infoCheck}>
          <input
            type="checkbox"
            checked={card.noBack ?? false}
            onChange={(e) => useCardsStore.getState().setNoBack(card.id, e.target.checked)}
          />
          {t('cardInfo.noBack')}
        </label>
      ) : null}
      <p className={styles.infoPosition}>{t('cardInfo.title', { position, total })}</p>
    </>
  );
}

const PANEL_WIDTH = 300;
const MARGIN = 16;
const NARROW = '(max-width: 560px)';

/** Botón «i» que abre la información de la carta; se cierra con Esc o al pulsar fuera. */
export function CardInfo(props: {
  card: CardImage;
  name: string;
  position: number;
  total: number;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [position, setPosition] = useState<CSSProperties>({});

  // Junto al botón y dentro de la ventana (en pantallas estrechas, el CSS lo pone abajo).
  useLayoutEffect(() => {
    if (!open || !buttonRef.current || window.matchMedia(NARROW).matches) return;
    const r = buttonRef.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(MARGIN, r.right - PANEL_WIDTH),
      window.innerWidth - PANEL_WIDTH - MARGIN,
    );
    setPosition({ top: r.bottom + 4, left, width: PANEL_WIDTH });
  }, [open]);

  // Si la lista se desplaza o cambia la ventana, el panel se cierra en vez de quedarse suelto.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', close);
    panelRef.current?.focus();
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const closeAndFocus = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.infoButton}
        aria-label={t('cardInfo.info', { name: props.name })}
        title={t('cardInfo.info', { name: props.name })}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 7v4.5M8 4.6v.1" />
        </svg>
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label={t('cardInfo.info', { name: props.name })}
              tabIndex={-1}
              className={styles.infoPanel}
              style={position}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  closeAndFocus();
                }
              }}
            >
              <InfoContent {...props} />
              <button type="button" className={styles.infoClose} onClick={closeAndFocus}>
                {t('cardInfo.close')}
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
