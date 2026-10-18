import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Checkbox, ColorField, FieldRow, RadioGroup, Section } from '../../components/form/Fields';
import { NumberField } from '../../components/form/NumberField';
import type { CutLineStyle, LayoutMode, PaperSize, Placement } from '../../lib/settings';
import { useSettingsStore } from '../../store/settingsStore';
import { useTemplatesStore } from '../templates/templatesStore';
import { CropDialog } from './CropDialog';
import styles from './SettingsPanel.module.css';

export function SettingsPanel() {
  const { t } = useTranslation();
  const s = useSettingsStore((st) => st.settings);
  const update = useSettingsStore((st) => st.update);
  const openAfter = useSettingsStore((st) => st.openAfter);
  const setOpenAfter = useSettingsStore((st) => st.setOpenAfter);
  const reset = useSettingsStore((st) => st.reset);
  const mm = t('settings.mm');
  const [cropOpen, setCropOpen] = useState(false);
  const templates = useTemplatesStore((st) => st.templates);
  const templateId = useId();
  const cropW = s.crop.widthMm > 0 ? s.crop.widthMm : t('crop.full');
  const cropH = s.crop.heightMm > 0 ? s.crop.heightMm : t('crop.full');

  return (
    <div className={styles.panel}>
      <Section title={t('settings.page')} defaultOpen>
        <RadioGroup<LayoutMode>
          legend={t('settings.mode')}
          value={s.mode}
          onChange={(mode) => update({ mode })}
          options={[
            { value: 'vertical9', label: t('settings.vertical9') },
            { value: 'horizontal8', label: t('settings.horizontal8') },
            { value: 'manual', label: t('settings.manual') },
            { value: 'template', label: t('settings.template') },
          ]}
        />
        {s.mode === 'template' ? (
          <FieldRow>
            {templates.length === 0 ? (
              <p className={styles.hint}>{t('settings.noTemplates')}</p>
            ) : (
              <div className={styles.select}>
                <label htmlFor={templateId}>{t('settings.chooseTemplate')}</label>
                <select
                  id={templateId}
                  value={s.template?.id ?? ''}
                  onChange={(e) =>
                    update({ template: templates.find((tp) => tp.id === e.target.value) ?? null })
                  }
                >
                  {s.template ? null : <option value="">{t('settings.templateMissing')}</option>}
                  {s.template && !templates.some((tp) => tp.id === s.template!.id) ? (
                    <option value={s.template.id}>
                      {t('settings.projectTemplate', { name: s.template.name })}
                    </option>
                  ) : null}
                  {templates.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {tp.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Link to="/templates" className={styles.reset}>
              {t('settings.editTemplates')}
            </Link>
          </FieldRow>
        ) : null}
        {s.mode === 'manual' ? (
          <FieldRow>
            <NumberField
              label={t('settings.columns')}
              value={s.columns}
              min={1}
              max={20}
              integer
              onChange={(columns) => update({ columns })}
            />
            <NumberField
              label={t('settings.rows')}
              value={s.rows}
              min={1}
              max={20}
              integer
              onChange={(rows) => update({ rows })}
            />
            <RadioGroup<PaperSize>
              legend={t('settings.paper')}
              value={s.paper}
              onChange={(paper) => update({ paper })}
              options={[
                { value: 'A4', label: t('settings.A4') },
                { value: 'A3', label: t('settings.A3') },
                { value: 'custom', label: t('settings.custom') },
              ]}
            />
            {s.paper === 'custom' ? (
              <>
                <NumberField
                  label={t('settings.pageWidth')}
                  value={s.customPageMm.width}
                  min={10}
                  unit={mm}
                  onChange={(width) => update({ customPageMm: { ...s.customPageMm, width } })}
                />
                <NumberField
                  label={t('settings.pageHeight')}
                  value={s.customPageMm.height}
                  min={10}
                  unit={mm}
                  onChange={(height) => update({ customPageMm: { ...s.customPageMm, height } })}
                />
              </>
            ) : null}
            <Checkbox
              label={t('settings.landscape')}
              checked={s.landscape}
              onChange={(landscape) => update({ landscape })}
            />
          </FieldRow>
        ) : null}
      </Section>

      <Section title={t('settings.placement')} defaultOpen>
        <RadioGroup<Placement>
          legend={t('settings.placement')}
          hideLegend
          value={s.placement}
          onChange={(placement) => update({ placement })}
          options={[
            { value: 'separated', label: t('settings.separated') },
            { value: 'together', label: t('settings.together') },
          ]}
        />
        {s.placement === 'separated' ? (
          <FieldRow>
            <NumberField
              label={t('settings.margin')}
              value={s.marginMm}
              min={0}
              unit={mm}
              onChange={(marginMm) => update({ marginMm })}
            />
          </FieldRow>
        ) : null}
        <Checkbox
          label={t('settings.rightToLeft')}
          checked={s.rightToLeft}
          onChange={(rightToLeft) => update({ rightToLeft })}
        />
        <Checkbox
          label={t('settings.duplex')}
          hint={t('settings.duplexHint')}
          checked={s.duplex}
          onChange={(duplex) => update({ duplex })}
        />
      </Section>

      <Section title={t('settings.size')}>
        <p className={styles.hint}>{t('settings.sizeHint')}</p>
        <Checkbox
          label={t('settings.forceWidth')}
          checked={s.forceWidth}
          onChange={(forceWidth) => update({ forceWidth })}
        />
        {s.forceWidth ? (
          <FieldRow>
            <NumberField
              label={t('settings.forceWidth')}
              value={s.cardWidthMm}
              min={1}
              unit={mm}
              onChange={(cardWidthMm) => update({ cardWidthMm })}
            />
          </FieldRow>
        ) : null}
        <Checkbox
          label={t('settings.forceHeight')}
          checked={s.forceHeight}
          onChange={(forceHeight) => update({ forceHeight })}
        />
        {s.forceHeight ? (
          <FieldRow>
            <NumberField
              label={t('settings.forceHeight')}
              value={s.cardHeightMm}
              min={1}
              unit={mm}
              onChange={(cardHeightMm) => update({ cardHeightMm })}
            />
          </FieldRow>
        ) : null}
      </Section>

      <Section title={t('settings.crop')}>
        <Checkbox
          label={t('settings.cropEnabled')}
          checked={s.crop.enabled}
          onChange={(enabled) => update({ crop: { ...s.crop, enabled } })}
        />
        {s.crop.enabled ? (
          <FieldRow>
            <p className={styles.hint}>
              {s.crop.centered
                ? t('crop.summaryCentered', { w: cropW, h: cropH })
                : t('crop.summaryAt', { w: cropW, h: cropH, x: s.crop.x, y: s.crop.y })}
            </p>
            <button type="button" className={styles.button} onClick={() => setCropOpen(true)}>
              {t('crop.edit')}
            </button>
          </FieldRow>
        ) : null}
        <CropDialog open={cropOpen} onClose={() => setCropOpen(false)} />
      </Section>

      <Section title={t('settings.cut')}>
        <Checkbox
          label={t('settings.cutLines')}
          checked={s.cutLines.enabled}
          onChange={(enabled) => update({ cutLines: { ...s.cutLines, enabled } })}
        />
        {s.cutLines.enabled ? (
          <FieldRow>
            {/* Con plantilla, cada hueco lleva sus marcas en las esquinas. */}
            {s.mode === 'template' ? (
              <p className={styles.hint}>{t('settings.templateMarks')}</p>
            ) : (
              <RadioGroup<CutLineStyle>
                legend={t('settings.style')}
                value={s.cutLines.style}
                onChange={(style) => update({ cutLines: { ...s.cutLines, style } })}
                options={[
                  { value: 'normal', label: t('settings.normal') },
                  { value: 'full', label: t('settings.full') },
                  { value: 'cross', label: t('settings.cross') },
                ]}
              />
            )}
            <ColorField
              label={t('settings.color')}
              value={s.cutLines.color}
              onChange={(color) => update({ cutLines: { ...s.cutLines, color } })}
            />
            <NumberField
              label={t('settings.lineWidth')}
              value={s.cutLines.widthHundredthsMm}
              min={1}
              integer
              unit={t('settings.hundredthsMm')}
              onChange={(widthHundredthsMm) =>
                update({ cutLines: { ...s.cutLines, widthHundredthsMm } })
              }
            />
          </FieldRow>
        ) : null}
        <Checkbox
          label={t('settings.bleed')}
          checked={s.bleed.enabled}
          onChange={(enabled) => update({ bleed: { ...s.bleed, enabled } })}
        />
        {s.bleed.enabled ? (
          <FieldRow>
            <NumberField
              label={t('settings.bleedWidth')}
              value={s.bleed.mm}
              min={0}
              unit={mm}
              onChange={(bleedMm) => update({ bleed: { ...s.bleed, mm: bleedMm } })}
            />
            <ColorField
              label={t('settings.color')}
              value={s.bleed.color}
              onChange={(color) => update({ bleed: { ...s.bleed, color } })}
            />
          </FieldRow>
        ) : null}
      </Section>

      <div className={styles.footer}>
        <Checkbox label={t('settings.openAfter')} checked={openAfter} onChange={setOpenAfter} />
        <button type="button" className={styles.reset} onClick={reset}>
          {t('settings.reset')}
        </button>
      </div>
    </div>
  );
}
