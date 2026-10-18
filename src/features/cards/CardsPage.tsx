import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCardsStore } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { CardTray } from './CardTray';
import { PrintPanel } from './PrintPanel';
import { SettingsPanel } from './SettingsPanel';
import styles from './CardsPage.module.css';

type Tab = 'settings' | 'cards' | 'preview';
const TABS: Tab[] = ['cards', 'settings', 'preview'];

function DpiWarning() {
  const { t } = useTranslation();
  const missing = useCardsStore((s) => s.cards.some((c) => c.blob && !c.dpi));
  const forced = useSettingsStore((s) => s.settings.forceWidth || s.settings.forceHeight);
  if (!missing || forced) return null;
  return (
    <p className={styles.warning} role="status">
      {t('cards.noDpi')}
    </p>
  );
}

export function CardsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('cards');

  return (
    <div className={styles.page}>
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
        <DpiWarning />
        <CardTray />
      </div>
      <aside
        id="panel-preview"
        className={styles.preview}
        data-active={tab === 'preview' || undefined}
        aria-label={t('cards.tabs.preview')}
      >
        <PrintPanel />
      </aside>
    </div>
  );
}
