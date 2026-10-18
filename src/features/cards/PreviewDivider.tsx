import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  clampPreviewWidth,
  DEFAULT_PREVIEW_WIDTH,
  previewWidthLimits,
} from '../../lib/previewWidth';
import { useSettingsStore } from '../../store/settingsStore';
import styles from './CardsPage.module.css';
import { usePreviewWidth, useViewportWidth } from './usePreviewWidth';

const STEP = 16;

/**
 * Divisor entre la lista de cartas y la vista previa: se arrastra con el ratón o el dedo, se mueve
 * con las flechas (16 px), Inicio y Fin; con doble clic vuelve al ancho por defecto.
 */
export function PreviewDivider() {
  const { t } = useTranslation();
  const viewport = useViewportWidth();
  const width = usePreviewWidth();
  const setWidth = useSettingsStore((s) => s.setPreviewWidth);
  const { min, max } = previewWidthLimits(viewport);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const set = (w: number) => setWidth(clampPreviewWidth(w, viewport));

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, width };
    setDragging(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    // La vista previa está a la derecha: arrastrar a la izquierda la ensancha.
    if (drag.current) set(drag.current.width - (e.clientX - drag.current.x));
  }

  function end() {
    drag.current = null;
    setDragging(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const next: Record<string, number> = {
      ArrowLeft: width + STEP,
      ArrowRight: width - STEP,
      Home: min,
      End: max,
    };
    if (!(e.key in next)) return;
    e.preventDefault();
    set(next[e.key]);
  }

  return (
    <div
      className={styles.divider}
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={t('cards.dividerLabel')}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      title={t('cards.dividerHint')}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => set(DEFAULT_PREVIEW_WIDTH)}
      onKeyDown={onKeyDown}
    >
      {dragging ? <span className={styles.dividerValue}>{width} px</span> : null}
    </div>
  );
}
