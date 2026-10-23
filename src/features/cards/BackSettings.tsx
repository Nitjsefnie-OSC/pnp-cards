import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, FieldRow, RadioGroup, Section } from '../../components/form/Fields';
import type { BackFlip } from '../../lib/settings';
import { useCardsStore, type NewImage } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { IMAGE_ACCEPT } from '../../lib/imageFormat';
import { HeicOfflineError, loadImage as defaultLoadImage } from './loadImages';
import styles from './SettingsPanel.module.css';

/** Reversos: activarlos, elegir la imagen del reverso común y cómo se da la vuelta al papel. */
export function BackSettings({
  loadImage = defaultLoadImage,
}: {
  loadImage?: (file: File) => Promise<NewImage>;
}) {
  const { t } = useTranslation();
  const backs = useSettingsStore((s) => s.settings.backs);
  const update = useSettingsStore((s) => s.update);
  const back = useCardsStore((s) => s.back);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File) {
    try {
      useCardsStore.getState().setBack(await loadImage(file));
      setError(null);
    } catch (err) {
      const offline = err instanceof HeicOfflineError ? ` ${t('cards.heicOffline')}` : '';
      setError(t('settings.backFailed', { name: file.name }) + offline);
    }
  }

  return (
    <Section title={t('settings.backs')} help="backs">
      <Checkbox
        label={t('settings.backsEnabled')}
        hint={t('settings.backsHint')}
        checked={backs.enabled}
        onChange={(enabled) => update({ backs: { ...backs, enabled } })}
      />
      {backs.enabled ? (
        <FieldRow>
          <div className={styles.back}>
            <span className={styles.label}>{t('settings.backImage')}</span>
            {back ? (
              <div className={styles.backPicked}>
                {back.thumbUrl ? (
                  <img src={back.thumbUrl} alt="" className={styles.backThumb} />
                ) : (
                  <span className={styles.backThumb} />
                )}
                <span className={styles.backText}>
                  <span className={styles.backName}>{back.name}</span>
                  {back.missing ? (
                    <span className={styles.error}>
                      {t('settings.backMissing', { name: back.name })}
                    </span>
                  ) : (
                    <span className={styles.hint}>
                      {t('settings.backSize', { w: back.widthPx, h: back.heightPx })}
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <p className={styles.hint}>{t('settings.backNone')}</p>
            )}
            <div className={styles.backActions}>
              <button
                type="button"
                className={styles.button}
                onClick={() => inputRef.current?.click()}
              >
                {back ? t('settings.backChange') : t('settings.backChoose')}
              </button>
              {back ? (
                <button
                  type="button"
                  className={styles.reset}
                  onClick={() => useCardsStore.getState().setBack(null)}
                >
                  {t('settings.backRemove')}
                </button>
              ) : null}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              hidden
              data-testid="back-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void choose(file);
                e.target.value = '';
              }}
            />
            {error ? (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            ) : null}
            <p className={styles.hint}>{t('settings.backFit')}</p>
            <p className={styles.hint}>{t('settings.backPerCard')}</p>
          </div>
          <RadioGroup<BackFlip>
            legend={t('settings.flip')}
            value={backs.flip}
            onChange={(flip) => update({ backs: { ...backs, flip } })}
            options={[
              { value: 'long', label: t('settings.flipLong') },
              { value: 'short', label: t('settings.flipShort') },
            ]}
          />
        </FieldRow>
      ) : null}
    </Section>
  );
}
