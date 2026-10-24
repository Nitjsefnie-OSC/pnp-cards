import { useMemo, useState, type CSSProperties } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useCardsStore } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { fixedSize, lowResolution, MIN_PRINT_DPI } from '../../lib/cardInfo';
import { ProjectBar } from '../../project/ProjectBar';
import { useProjectActions } from '../../project/useProjectActions';
import { CardTray } from './CardTray';
import { PreviewDivider } from './PreviewDivider';
import { usePreviewWidth } from './usePreviewWidth';
import { PrintPanel } from './PrintPanel';
import { rotationsOf } from './rotations';
import { SettingsPanel } from './SettingsPanel';
import styles from './CardsPage.module.css';

type Tab = 'settings' | 'cards' | 'preview';
const TABS: Tab[] = ['cards', 'settings', 'preview'];

function DpiWarning() {
  const { t } = useTranslation();
  const missing = useCardsStore((s) => s.cards.some((c) => c.blob && !c.dpi));
  const sized = useSettingsStore((s) => fixedSize(s.settings));
  if (!missing || sized) return null;
  return (
    <p className={styles.warning} role="status">
      {t('cards.noDpi')}
    </p>
  );
}

/** Cuántas cartas saldrán por debajo de los ppp mínimos a su tamaño de impresión. */
function LowDpiWarning() {
  const settings = useSettingsStore((s) => s.settings);
  const cards = useCardsStore((s) => s.cards);
  const count = useMemo(() => {
    const rotations = rotationsOf(settings, cards);
    return cards.filter((c, i) => c.blob && lowResolution(c, settings, rotations[i])).length;
  }, [cards, settings]);
  if (count === 0) return null;
  return (
    <p className={`${styles.warning} ${styles.lowDpi}`} role="status">
      <Trans
        i18nKey="cards.lowDpi"
        count={count}
        values={{ min: MIN_PRINT_DPI }}
        components={{ strong: <strong /> }}
      />
    </p>
  );
}

export function CardsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('cards');
  const actions = useProjectActions();
  const previewWidth = usePreviewWidth();

  return (
    <div
      className={styles.page}
      style={{ '--preview-width': `${previewWidth}px` } as CSSProperties}
    >
      <div className={styles.tabs} role="tablist">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className={styles.tab}
            onClick={() => setTab(id)}
          >
            {t(`cards.tabs.${id}`)}
          </button>
        ))}
      </div>
      <aside
        id="panel-settings"
        className={styles.settings}
        data-active={tab === 'settings' || undefined}
        aria-label={t('cards.tabs.settings')}
      >
        <SettingsPanel />
      </aside>
      <div id="panel-cards" className={styles.cards} data-active={tab === 'cards' || undefined}>
        <ProjectBar actions={actions} />
        <DpiWarning />
        <LowDpiWarning />
        <CardTray onProjectFile={(file) => void actions.openFile(file)} />
      </div>
      <aside
        id="panel-preview"
        className={styles.preview}
        data-active={tab === 'preview' || undefined}
        aria-label={t('cards.tabs.preview')}
      >
        <PreviewDivider />
        <PrintPanel />
      </aside>
    </div>
  );
}
