import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { RadioGroup } from '../../components/form/Fields';
import { NumberField } from '../../components/form/NumberField';
import type { RasterFormat } from '../../pdf/rasterize';
import styles from './RasterFields.module.css';
import type { RasterSettings } from './useRasterSettings';

const PRESETS = [150, 300, 600];
/** Por encima de esto (píxeles por página) el navegador puede quedarse sin memoria. */
const BIG_PAGE = 40e6;

/**
 * Controles de `useRasterSettings`, como celdas de una rejilla (el tamaño ocupa toda la fila).
 * `onChange` avisa de cualquier cambio, para invalidar un resultado anterior.
 */
export function RasterFields({
  settings: s,
  pageCount,
  onChange,
}: {
  settings: RasterSettings;
  pageCount: number;
  onChange?: () => void;
}) {
  const { t } = useTranslation();
  const rangeId = useId();
  const changed =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      onChange?.();
    };

  return (
    <>
      <RadioGroup<RasterFormat>
        legend={t('extract.format')}
        value={s.format}
        onChange={changed(s.setFormat)}
        options={[
          { value: 'jpeg', label: t('extract.jpeg') },
          { value: 'png', label: t('extract.png') },
        ]}
      />

      <fieldset className={styles.dpi}>
        <legend>{t('extract.resolution')}</legend>
        <div className={styles.segmented}>
          {[...PRESETS.map(String), 'custom'].map((value) => (
            <label key={value} data-checked={s.preset === value || undefined}>
              <input
                type="radio"
                name={`dpi-${rangeId}`}
                value={value}
                checked={s.preset === value}
                onChange={() => changed(s.setPreset)(value)}
              />
              {value === 'custom' ? t('extract.custom') : value}
            </label>
          ))}
          <span className={styles.unit}>{t('extract.dpi')}</span>
        </div>
        {s.preset === 'custom' ? (
          <NumberField
            label={t('extract.resolution')}
            value={s.customDpi}
            min={36}
            max={1200}
            integer
            unit={t('extract.dpi')}
            onChange={changed(s.setCustomDpi)}
          />
        ) : null}
      </fieldset>

      <div className={styles.range}>
        <label htmlFor={rangeId}>{t('extract.range')}</label>
        <input
          id={rangeId}
          value={s.range}
          placeholder={t('extract.rangeHint')}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={s.pages === null || undefined}
          onChange={(e) => changed(s.setRange)(e.target.value)}
        />
        {s.pages === null ? (
          <p className={styles.error}>{t('extract.rangeInvalid', { count: pageCount })}</p>
        ) : null}
      </div>

      {s.size ? (
        <p className={styles.info}>
          {t('extract.pageSize', { w: s.size.width, h: s.size.height })}
          {s.size.width * s.size.height > BIG_PAGE ? (
            <span className={styles.warning}> {t('extract.big')}</span>
          ) : null}
        </p>
      ) : null}
    </>
  );
}
