import { memo, useId, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { useCardsStore, type CardImage } from '../../store/cardsStore';
import { CardInfo } from './CardInfo';
import { loadImage } from './loadImages';
import styles from './CardTile.module.css';

/**
 * Número de copias: botones − y + y un campo que deja escribir libremente (solo guarda enteros
 * positivos).
 */
function CopiesInput({ id, copies, name }: { id: string; copies: number; name: string }) {
  const { t } = useTranslation();
  const inputId = useId();
  const [text, setText] = useState(String(copies));
  const [last, setLast] = useState(copies);
  if (copies !== last) {
    setLast(copies);
    setText(String(copies));
  }
  const set = (n: number) => useCardsStore.getState().setCopies(id, n);

  return (
    <div className={styles.copies}>
      <label htmlFor={inputId} className={styles.copiesLabel}>
        {t('cards.copies')}
      </label>
      <div className={styles.stepper}>
        <button
          type="button"
          aria-label={t('cards.copiesLess', { name })}
          disabled={copies <= 1}
          onClick={() => set(copies - 1)}
        >
          −
        </button>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          aria-label={t('cards.copiesOf', { name })}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= 1) {
              setLast(n);
              set(n);
            }
          }}
          onBlur={() => setText(String(copies))}
        />
        <button
          type="button"
          aria-label={t('cards.copiesMore', { name })}
          onClick={() => set(copies + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

export const CardTile = memo(function CardTile({
  card,
  position,
  total,
}: {
  card: CardImage;
  position: number;
  total: number;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });
  const name = card.blob || card.missing ? card.name : t('cards.blankName');

  return (
    <li
      ref={setNodeRef}
      className={styles.tile}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.handle}
        aria-label={t('cards.drag', { name })}
        {...attributes}
        {...listeners}
      >
        {card.missing ? (
          <span className={styles.missing} title={card.path}>
            {t('cards.missing')}
          </span>
        ) : card.thumbUrl ? (
          <img
            src={card.thumbUrl}
            alt=""
            width={card.widthPx}
            height={card.heightPx}
            loading="lazy"
            draggable={false}
          />
        ) : (
          <span className={styles.blank} />
        )}
      </button>
      <div className={styles.meta}>
        <span className={styles.name} title={name}>
          {name}
        </span>
        {card.missing ? (
          <label className={styles.find}>
            {t('cards.find')}
            <input
              type="file"
              accept="image/*,.tif,.tiff"
              className="visually-hidden"
              aria-label={t('cards.findNamed', { name })}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file)
                  void loadImage(file)
                    .then((img) => useCardsStore.getState().replaceImage(card.id, img))
                    .catch(() => {});
              }}
            />
          </label>
        ) : null}
        {card.blob ? (
          <span className={styles.dpi} data-missing={!card.dpi || undefined}>
            {card.dpi
              ? t('cards.dpiBadge', { dpi: card.dpi.x })
              : t('cards.dpiBadge', { dpi: '?' })}
          </span>
        ) : null}
      </div>
      {/* Información y quitar, sobre la esquina de la miniatura. */}
      <div className={styles.tools}>
        <CardInfo card={card} name={name} position={position} total={total} />
        <button
          type="button"
          className={styles.remove}
          aria-label={t('cards.remove', { name })}
          title={t('cards.remove', { name })}
          onClick={() => useCardsStore.getState().remove(card.id)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      <CopiesInput id={card.id} copies={card.copies} name={name} />
    </li>
  );
});
