import { useTranslation } from 'react-i18next';
import { Checkbox } from '../../components/form/Fields';
import { useUiStore } from '../../store/uiStore';
import styles from './PrivacyPage.module.css';

/** Qué se mide y qué no, y la casilla para desactivar las estadísticas. */
export function PrivacyPage() {
  const { t } = useTranslation();
  const analytics = useUiStore((s) => s.analytics);
  const setAnalytics = useUiStore((s) => s.setAnalytics);
  const doNotTrack = navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  const measured = t('privacy.measuredItems', { returnObjects: true }) as string[];
  const never = t('privacy.neverItems', { returnObjects: true }) as string[];

  return (
    <article className={styles.page}>
      <h1>{t('privacy.title')}</h1>
      <p className={styles.lead}>{t('privacy.local')}</p>
      <p>{t('privacy.stats')}</p>

      <h2>{t('privacy.measured')}</h2>
      <ul>
        {measured.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2>{t('privacy.never')}</h2>
      <ul>
        {never.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className={styles.choice}>
        <Checkbox label={t('privacy.optIn')} checked={analytics} onChange={setAnalytics} />
        {doNotTrack ? <p className={styles.note}>{t('privacy.doNotTrack')}</p> : null}
      </div>
    </article>
  );
}
