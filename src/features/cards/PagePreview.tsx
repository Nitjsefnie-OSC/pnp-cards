import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { planDocument, PlanError, type DocumentPlan, type PlannedItem } from '../../lib/plan';
import { useCardsStore, type CardImage } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';
import styles from './PagePreview.module.css';

type PlanResult = { plan: DocumentPlan } | { error: PlanError } | null;

function usePlan(): PlanResult {
  const cards = useCardsStore((s) => s.cards);
  const settings = useSettingsStore((s) => s.settings);
  return useMemo(() => {
    if (cards.length === 0) return null;
    try {
      return {
        plan: planDocument(
          settings,
          cards.map((c) => ({ ...c, blank: c.blob === null })),
        ),
      };
    } catch (err) {
      if (err instanceof PlanError) return { error: err };
      throw err;
    }
  }, [cards, settings]);
}

/** Una carta en la página, con la parte recortada oculta igual que en el PDF. */
function PreviewCard({
  item,
  card,
  pageHeight,
}: {
  item: PlannedItem;
  card: CardImage;
  pageHeight: number;
}) {
  const { x, width, height } = item.placement;
  const y = pageHeight - item.placement.y - height;
  if (!card.thumbUrl) {
    return <rect x={x} y={y} width={width} height={height} className={styles.blank} />;
  }
  const crop = item.crop ?? { x: 0, y: 0, width: card.widthPx, height: card.heightPx };
  return (
    <svg
      x={x}
      y={y}
      width={width}
      height={height}
      viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`}
      preserveAspectRatio="none"
    >
      <image
        href={card.thumbUrl}
        width={card.widthPx}
        height={card.heightPx}
        preserveAspectRatio="none"
      />
    </svg>
  );
}

export function PagePreview() {
  const { t } = useTranslation();
  const result = usePlan();
  const cards = useCardsStore((s) => s.cards);
  const bleedColor = useSettingsStore((s) => s.settings.bleed.color);
  const lineColor = useSettingsStore((s) => s.settings.cutLines.color);
  const [requested, setRequested] = useState(0);

  if (!result) return <p className={styles.message}>{t('preview.empty')}</p>;
  if ('error' in result) {
    return (
      <p className={styles.message} role="alert">
        {t(result.error.code === 'empty' ? 'cards.errorEmpty' : 'cards.errorBlank')}
      </p>
    );
  }

  const { plan } = result;
  const index = Math.min(requested, plan.pages.length - 1);
  const page = plan.pages[index];
  const { width: W, height: H } = page.size;

  return (
    <div className={styles.preview}>
      <div className={styles.stage}>
        <svg
          className={styles.page}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={t('preview.label', { page: page.number })}
          style={{ '--ratio': W / H } as CSSProperties}
        >
          <rect width={W} height={H} className={styles.paper} />
          {page.bleed.map((r, i) => (
            <rect
              key={i}
              x={r.x}
              y={H - r.y - r.height}
              width={r.width}
              height={r.height}
              fill={bleedColor}
            />
          ))}
          {page.items.map((item, i) => (
            <PreviewCard key={i} item={item} card={cards[item.card]} pageHeight={H} />
          ))}
          {page.cutLines ? (
            <g stroke={lineColor} className={styles.lines}>
              {page.cutLines.segments.map((s, i) => (
                <line key={i} x1={s.x1} y1={H - s.y1} x2={s.x2} y2={H - s.y2} />
              ))}
            </g>
          ) : null}
        </svg>
      </div>

      <div className={styles.nav}>
        <button
          type="button"
          aria-label={t('preview.prev')}
          disabled={index === 0}
          onClick={() => setRequested(index - 1)}
        >
          ‹
        </button>
        <span aria-live="polite">
          {t('preview.page', { page: index + 1, pages: plan.pages.length })}
        </span>
        <button
          type="button"
          aria-label={t('preview.next')}
          disabled={index === plan.pages.length - 1}
          onClick={() => setRequested(index + 1)}
        >
          ›
        </button>
      </div>
      {plan.clampedCards.length > 0 ? (
        <p className={styles.warning}>
          {t('preview.clamped', { count: plan.clampedCards.length })}
        </p>
      ) : null}
    </div>
  );
}
