import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { downloadBlob } from '../../components/download';
import { NumberField } from '../../components/form/NumberField';
import { cardSize } from '../../lib/cardSize';
import { safeFileName } from '../../lib/filename';
import {
  parseTemplateFile,
  ROTATIONS,
  serializeTemplate,
  TEMPLATE_EXTENSION,
  templateFromLayout,
  type Template,
} from '../../lib/template';
import { ptToMm } from '../../lib/units';
import { printableCards, useCardsStore } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { TemplateCanvas } from './TemplateCanvas';
import { useTemplatesStore } from './templatesStore';
import styles from './TemplatesPage.module.css';

const PAGE_PRESETS = [
  { key: 'A4', width: 210, height: 297 },
  { key: 'A3', width: 297, height: 420 },
  { key: 'letter', width: 216, height: 279 },
] as const;

/** Tamaño de carta para «desde la distribución actual»: forzado, el de la primera carta o 63 × 88. */
function currentCardMm() {
  const { settings } = useSettingsStore.getState();
  if (settings.forceWidth && settings.forceHeight) {
    return { widthMm: settings.cardWidthMm, heightMm: settings.cardHeightMm };
  }
  const first = printableCards(useCardsStore.getState().cards).find((c) => c.blob);
  if (first) {
    const size = cardSize(first, settings);
    return {
      widthMm: Math.round(ptToMm(size.width) * 10) / 10,
      heightMm: Math.round(ptToMm(size.height) * 10) / 10,
    };
  }
  return { widthMm: 63, heightMm: 88 };
}

export function TemplatesPage() {
  const { t } = useTranslation();
  const nameId = useId();
  const importRef = useRef<HTMLInputElement>(null);
  const { templates, selectedId, selectedSlotId } = useTemplatesStore(
    useShallow((s) => ({
      templates: s.templates,
      selectedId: s.selectedId,
      selectedSlotId: s.selectedSlotId,
    })),
  );
  const actions = useTemplatesStore.getState();
  const inUseId = useSettingsStore((s) =>
    s.settings.mode === 'template' ? s.settings.template?.id : null,
  );
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const template = templates.find((tp) => tp.id === selectedId) ?? templates[0];
  const slotIndex = template?.slots.findIndex((s) => s.id === selectedSlotId) ?? -1;
  const slot = slotIndex >= 0 ? template!.slots[slotIndex] : null;

  const outside = template?.slots.some(
    (s) =>
      s.xMm < 0 ||
      s.yMm < 0 ||
      s.xMm + s.widthMm > template.pageMm.width ||
      s.yMm + s.heightMm > template.pageMm.height,
  );

  function newBlank() {
    actions.add({
      id: crypto.randomUUID(),
      name: t('templates.defaultName', { n: templates.length + 1 }),
      pageMm: { width: 210, height: 297 },
      slots: [],
    });
  }

  function fromLayout() {
    const { settings } = useSettingsStore.getState();
    actions.add(templateFromLayout(settings, currentCardMm(), t('templates.fromLayoutName')));
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      actions.add(parseTemplateFile(await file.text()));
      setMessage(null);
    } catch {
      setMessage({ text: t('templates.importFailed', { name: file.name }), tone: 'error' });
    }
  }

  function use(tp: Template) {
    useSettingsStore.getState().update({ mode: 'template', template: tp });
    setMessage({ text: t('templates.used', { name: tp.name }), tone: 'info' });
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1>{t('templates.title')}</h1>
        <p>{t('templates.intro')}</p>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.list} aria-label={t('templates.list')}>
          <div className={styles.listActions}>
            <button type="button" className={styles.secondary} onClick={newBlank}>
              {t('templates.newBlank')}
            </button>
            <button type="button" className={styles.secondary} onClick={fromLayout}>
              {t('templates.fromLayout')}
            </button>
            <button
              type="button"
              className={styles.link}
              onClick={() => importRef.current?.click()}
            >
              {t('templates.import')}
            </button>
            <input
              ref={importRef}
              type="file"
              accept={`${TEMPLATE_EXTENSION},application/json`}
              hidden
              data-testid="template-input"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
          {message ? (
            <p className={message.tone === 'error' ? styles.error : styles.muted} role="status">
              {message.text}
            </p>
          ) : null}
          <ul>
            {templates.map((tp) => (
              <li key={tp.id} data-selected={tp.id === template?.id || undefined}>
                <button
                  type="button"
                  className={styles.pick}
                  aria-current={tp.id === template?.id || undefined}
                  onClick={() => actions.select(tp.id)}
                >
                  <span className={styles.pickName}>{tp.name || '—'}</span>
                  <span className={styles.muted}>
                    {tp.pageMm.width} × {tp.pageMm.height} {t('templates.mm')},{' '}
                    {t('templates.slots', { count: tp.slots.length })}
                  </span>
                  {tp.id === inUseId ? (
                    <span className={styles.inUse}>{t('templates.inUse')}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {!template ? (
          <div className={styles.empty}>
            <p>{t('templates.empty')}</p>
          </div>
        ) : (
          <>
            <TemplateCanvas
              template={template}
              selectedSlotId={selectedSlotId}
              onSelect={actions.selectSlot}
              onChange={(id, patch) => actions.updateSlot(template.id, id, patch)}
            />

            <div className={styles.fields}>
              <div className={styles.text}>
                <label htmlFor={nameId}>{t('templates.name')}</label>
                <input
                  id={nameId}
                  value={template.name}
                  autoComplete="off"
                  onChange={(e) => actions.update(template.id, { name: e.target.value })}
                />
              </div>

              <fieldset>
                <legend>{t('templates.page')}</legend>
                <div className={styles.presets}>
                  {PAGE_PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className={styles.chip}
                      onClick={() =>
                        actions.update(template.id, {
                          pageMm: { width: p.width, height: p.height },
                        })
                      }
                    >
                      {p.key === 'letter' ? t('templates.letter') : p.key}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={styles.chip}
                    onClick={() =>
                      actions.update(template.id, {
                        pageMm: { width: template.pageMm.height, height: template.pageMm.width },
                      })
                    }
                  >
                    {t('templates.swap')}
                  </button>
                </div>
                <NumberField
                  label={t('templates.width')}
                  value={template.pageMm.width}
                  min={10}
                  unit={t('templates.mm')}
                  onChange={(width) =>
                    actions.update(template.id, { pageMm: { ...template.pageMm, width } })
                  }
                />
                <NumberField
                  label={t('templates.height')}
                  value={template.pageMm.height}
                  min={10}
                  unit={t('templates.mm')}
                  onChange={(height) =>
                    actions.update(template.id, { pageMm: { ...template.pageMm, height } })
                  }
                />
              </fieldset>

              <fieldset>
                <legend>
                  {slot
                    ? t('templates.slot', { n: slotIndex + 1 })
                    : t('templates.slots', { count: template.slots.length })}
                </legend>
                {slot ? (
                  <>
                    {(['xMm', 'yMm', 'widthMm', 'heightMm'] as const).map((key) => (
                      <NumberField
                        key={key}
                        label={t(
                          `templates.${{ xMm: 'x', yMm: 'y', widthMm: 'width', heightMm: 'height' }[key]}`,
                        )}
                        value={slot[key]}
                        min={key === 'widthMm' || key === 'heightMm' ? 1 : undefined}
                        unit={t('templates.mm')}
                        onChange={(v) => actions.updateSlot(template.id, slot.id, { [key]: v })}
                      />
                    ))}
                    <div
                      className={styles.rotation}
                      role="radiogroup"
                      aria-label={t('templates.rotation')}
                    >
                      <span className={styles.muted}>{t('templates.rotation')}</span>
                      <div className={styles.presets}>
                        {ROTATIONS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            role="radio"
                            aria-checked={slot.rotation === r}
                            className={styles.chip}
                            data-checked={slot.rotation === r || undefined}
                            onClick={() =>
                              actions.updateSlot(template.id, slot.id, { rotation: r })
                            }
                          >
                            {r}°
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={styles.presets}>
                      <button
                        type="button"
                        className={styles.chip}
                        disabled={slotIndex === 0}
                        onClick={() => actions.moveSlot(template.id, slot.id, -1)}
                      >
                        {t('templates.earlier')}
                      </button>
                      <button
                        type="button"
                        className={styles.chip}
                        disabled={slotIndex === template.slots.length - 1}
                        onClick={() => actions.moveSlot(template.id, slot.id, 1)}
                      >
                        {t('templates.later')}
                      </button>
                      <button
                        type="button"
                        className={styles.chip}
                        onClick={() => actions.duplicateSlot(template.id, slot.id)}
                      >
                        {t('templates.duplicate')}
                      </button>
                      <button
                        type="button"
                        className={styles.chip}
                        onClick={() => actions.removeSlot(template.id, slot.id)}
                      >
                        {t('templates.removeSlot')}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className={styles.muted}>{t('templates.noSlot')}</p>
                )}
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => actions.addSlot(template.id)}
                >
                  {t('templates.addSlot')}
                </button>
              </fieldset>

              {outside ? <p className={styles.error}>{t('templates.outside')}</p> : null}

              <div className={styles.templateActions}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={template.slots.length === 0}
                  onClick={() => use(template)}
                >
                  {template.id === inUseId ? t('templates.inUse') : t('templates.use')}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() =>
                    downloadBlob(
                      new Blob([serializeTemplate(template)], { type: 'application/json' }),
                      `${safeFileName(template.name) || 'plantilla'}${TEMPLATE_EXTENSION}`,
                    )
                  }
                >
                  {t('templates.export')}
                </button>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => {
                    if (window.confirm(t('templates.removeConfirm', { name: template.name })))
                      actions.remove(template.id);
                  }}
                >
                  {t('templates.remove')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
