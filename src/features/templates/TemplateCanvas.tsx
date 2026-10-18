import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Template, TemplateSlot } from '../../lib/template';
import styles from './TemplatesPage.module.css';

type Mode = 'move' | 'nw' | 'ne' | 'sw' | 'se';
const CORNERS: Exclude<Mode, 'move'>[] = ['nw', 'ne', 'sw', 'se'];
const MIN_MM = 5;

/** Al milímetro. */
const snap = (mm: number) => Math.round(mm);

interface Props {
  template: Template;
  selectedSlotId: string | null;
  onSelect: (slotId: string | null) => void;
  onChange: (slotId: string, patch: Partial<Omit<TemplateSlot, 'id'>>) => void;
}

/** La página de la plantilla con sus huecos: se eligen, se mueven y se redimensionan. */
export function TemplateCanvas({ template, selectedSlotId, onSelect, onChange }: Props) {
  const { t } = useTranslation();
  const pageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: Mode; id: string; x: number; y: number; start: TemplateSlot } | null>(
    null,
  );
  const { width: W, height: H } = template.pageMm;

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    const id = e.currentTarget.dataset.slot!;
    const slot = template.slots.find((s) => s.id === id);
    if (!slot) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    onSelect(id);
    drag.current = {
      mode: e.currentTarget.dataset.mode as Mode,
      id,
      x: e.clientX,
      y: e.clientY,
      start: slot,
    };
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    const page = pageRef.current;
    if (!d || !page) return;
    const mmPerPx = W / page.getBoundingClientRect().width;
    const dx = (e.clientX - d.x) * mmPerPx;
    const dy = (e.clientY - d.y) * mmPerPx;
    const s = d.start;
    if (d.mode === 'move') {
      onChange(d.id, { xMm: snap(s.xMm + dx), yMm: snap(s.yMm + dy) });
      return;
    }
    const right = s.xMm + s.widthMm;
    const bottom = s.yMm + s.heightMm;
    const left = d.mode.includes('w') ? Math.min(snap(s.xMm + dx), right - MIN_MM) : s.xMm;
    const top = d.mode.includes('n') ? Math.min(snap(s.yMm + dy), bottom - MIN_MM) : s.yMm;
    const newRight = d.mode.includes('e') ? Math.max(snap(right + dx), left + MIN_MM) : right;
    const newBottom = d.mode.includes('s') ? Math.max(snap(bottom + dy), top + MIN_MM) : bottom;
    onChange(d.id, { xMm: left, yMm: top, widthMm: newRight - left, heightMm: newBottom - top });
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, slot: TemplateSlot) {
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
    onChange(slot.id, { xMm: slot.xMm + move[0], yMm: slot.yMm + move[1] });
  }

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  const end = () => (drag.current = null);

  return (
    <div className={styles.stageWrap} onPointerDown={() => onSelect(null)}>
      <div
        ref={pageRef}
        className={styles.page}
        style={{ aspectRatio: `${W} / ${H}`, '--ratio': W / H } as CSSProperties}
      >
        {template.slots.map((slot, i) => {
          const selected = slot.id === selectedSlotId;
          return (
            <button
              key={slot.id}
              type="button"
              className={styles.slot}
              data-selected={selected || undefined}
              data-rotation={slot.rotation}
              data-slot={slot.id}
              data-mode="move"
              aria-pressed={selected}
              aria-label={t('templates.slotLabel', {
                n: i + 1,
                w: slot.widthMm,
                h: slot.heightMm,
                r: slot.rotation,
              })}
              style={{
                left: pct(slot.xMm, W),
                top: pct(slot.yMm, H),
                width: pct(slot.widthMm, W),
                height: pct(slot.heightMm, H),
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={end}
              onPointerCancel={end}
              onKeyDown={(e) => onKeyDown(e, slot)}
            >
              <span className={styles.slotNumber}>{i + 1}</span>
              {selected
                ? CORNERS.map((corner) => (
                    <span
                      key={corner}
                      className={styles.corner}
                      data-slot={slot.id}
                      data-mode={corner}
                      aria-hidden="true"
                      onPointerDown={onPointerDown}
                      onPointerMove={onPointerMove}
                      onPointerUp={end}
                      onPointerCancel={end}
                    />
                  ))
                : null}
            </button>
          );
        })}
      </div>
      <p className={styles.hint}>{t('templates.hint')}</p>
    </div>
  );
}
