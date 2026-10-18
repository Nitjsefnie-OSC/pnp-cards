import { useTranslation } from 'react-i18next';

export function ComingSoon({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <section style={{ padding: 'var(--space-5) var(--space-4)', maxWidth: '60ch' }}>
      <h1>{t(titleKey)}</h1>
      <p>{t('common.comingSoon')}</p>
    </section>
  );
}
