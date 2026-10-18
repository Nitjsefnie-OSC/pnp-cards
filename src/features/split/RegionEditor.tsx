import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useObjectUrl } from '../../components/useObjectUrl';
import type { PxRect } from '../../lib/crop';
import { splitGrid } from '../../lib/split';
import type { NewImage } from '../../store/cardsStore';
import styles from './SplitPage.module.css';

type Mode = 'move' | 'nw' | 'ne' | 'sw' | 'se';
const CORNERS: Exclude<Mode, 'move'>[] = ['nw', 'ne', 'sw', 'se'];

interface Props {
  image: NewImage;
  region: PxRect;
  columns: number;
  rows: number;
  onChange: (region: PxRect) => void;
}

/** La imagen con la zona a dividir y la rejilla de partes; la zona se mueve y se redimensiona. */
export function RegionEditor({ image, region, columns, rows, onChange }: Props) {
  const { t } = useTranslation();
  const url = useObjectUrl(image.blob);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: Mode; x: number; y: number; start: PxRect } | null>(null);
  const W = image.widthPx;
  const H = image.heightPx;

  /** La zona (data-mode="move") o una de sus esquinas (data-mode="nw"…). */
  function onPointerDown(e: PointerEvent<HTMLElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const mode = e.currentTarget.dataset.mode as Mode;
    drag.current = { mode, x: e.clientX, y: e.clientY, start: region };
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    const stage = stageRef.current;
    if (!d || !stage) return;
    const scale = W / stage.getBoundingClientRect().width;
    const dx = (e.clientX - d.x) * scale;
    const dy = (e.clientY - d.y) * scale;
    const s = d.start;
    if (d.mode === 'move') {
      onChange({ ...s, x: s.x + dx, y: s.y + dy });
      return;
    }
    // Las esquinas mueven sus dos lados; la opuesta se queda quieta.
    const left = d.mode.includes('w') ? Math.min(s.x + dx, s.x + s.width - 1) : s.x;
    const top = d.mode.includes('n') ? Math.min(s.y + dy, s.y + s.height - 1) : s.y;
    const right = d.mode.includes('e') ? Math.max(s.x + s.width + dx, s.x + 1) : s.x + s.width;
    const bottom = d.mode.includes('s') ? Math.max(s.y + s.height + dy, s.y + 1) : s.y + s.height;
    const x = Math.max(0, left);
    const y = Math.max(0, top);
    onChange({ x, y, width: Math.min(right, W) - x, height: Math.min(bottom, H) - y });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
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
    onChange({ ...region, x: region.x + move[0], y: region.y + move[1] });
  }

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  const parts = splitGrid(region, columns, rows);
  const xs = [...new Set(parts.map((p) => p.x))].slice(1);
  const ys = [...new Set(parts.map((p) => p.y))].slice(1);
  const end = () => (drag.current = null);

  return (
    <div className={styles.stageWrap}>
      <div
        ref={stageRef}
        className={styles.stage}
        style={{ aspectRatio: `${W} / ${H}`, '--ratio': W / H } as CSSProperties}
      >
        {url ? <img src={url} alt="" width={W} height={H} draggable={false} /> : null}
        <svg
          className={styles.grid}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {xs.map((x) => (
            <line key={`x${x}`} x1={x} x2={x} y1={region.y} y2={region.y + region.height} />
          ))}
          {ys.map((y) => (
            <line key={`y${y}`} x1={region.x} x2={region.x + region.width} y1={y} y2={y} />
          ))}
        </svg>
        <div
          className={styles.region}
          role="slider"
          tabIndex={0}
          aria-label={t('split.area')}
          aria-valuenow={region.x}
          aria-valuetext={`X ${region.x}, Y ${region.y}, ${region.width} × ${region.height} px`}
          style={{
            left: pct(region.x, W),
            top: pct(region.y, H),
            width: pct(region.width, W),
            height: pct(region.height, H),
          }}
          data-mode="move"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={end}
          onPointerCancel={end}
          onKeyDown={onKeyDown}
        >
          {CORNERS.map((corner) => (
            <span
              key={corner}
              className={styles.corner}
              data-mode={corner}
              aria-hidden="true"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={end}
              onPointerCancel={end}
            />
          ))}
        </div>
      </div>
      <p className={styles.hint}>{t('split.hint')}</p>
    </div>
  );
}
