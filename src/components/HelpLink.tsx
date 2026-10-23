import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { HelpTopicId } from '../features/help/topics';
import styles from './HelpLink.module.css';

/** Botón «?» que abre la ayuda en su tema. El tipo del tema garantiza que existe. */
export function HelpLink({ topic, className }: { topic: HelpTopicId; className?: string }) {
  const { t } = useTranslation();
  const label = t('help.about', { topic: t(`help.topics.${topic}`) });
  return (
    <Link
      to={`/help/${topic}`}
      className={className ? `${styles.link} ${className}` : styles.link}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">?</span>
    </Link>
  );
}
