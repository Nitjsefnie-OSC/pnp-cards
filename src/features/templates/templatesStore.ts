import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizeTemplate, type Template, type TemplateSlot } from '../../lib/template';
import { useSettingsStore } from '../../store/settingsStore';

interface TemplatesState {
  templates: Template[];
  selectedId: string | null;
  selectedSlotId: string | null;
  add: (template: Template) => void;
  update: (id: string, patch: Partial<Omit<Template, 'id' | 'slots'>>) => void;
  remove: (id: string) => void;
  select: (id: string | null) => void;
  selectSlot: (id: string | null) => void;
  addSlot: (templateId: string, slot?: Partial<TemplateSlot>) => void;
  updateSlot: (
    templateId: string,
    slotId: string,
    patch: Partial<Omit<TemplateSlot, 'id'>>,
  ) => void;
  removeSlot: (templateId: string, slotId: string) => void;
  duplicateSlot: (templateId: string, slotId: string) => void;
  /** Cambia el orden de relleno: -1 adelanta el hueco, +1 lo retrasa. */
  moveSlot: (templateId: string, slotId: string, delta: -1 | 1) => void;
}

/** Tamaño por defecto de un hueco nuevo: carta estándar de 63 × 88 mm. */
const NEW_SLOT = { widthMm: 63, heightMm: 88 };
const OFFSET_MM = 5;

/** Si Cartas usa esta plantilla, su copia en los ajustes se actualiza también. */
function syncSettings(template: Template) {
  const settings = useSettingsStore.getState();
  if (settings.settings.template?.id === template.id) settings.update({ template });
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set, get) => {
      /** Cambia una plantilla y la sincroniza con los ajustes. */
      const change = (id: string, fn: (t: Template) => Template) => {
        set((s) => ({ templates: s.templates.map((t) => (t.id === id ? fn(t) : t)) }));
        const changed = get().templates.find((t) => t.id === id);
        if (changed) syncSettings(changed);
      };

      return {
        templates: [],
        selectedId: null,
        selectedSlotId: null,

        add: (template) =>
          set((s) => ({
            templates: [...s.templates, template],
            selectedId: template.id,
            selectedSlotId: template.slots[0]?.id ?? null,
          })),

        update: (id, patch) => change(id, (t) => ({ ...t, ...patch })),

        remove: (id) =>
          set((s) => {
            const templates = s.templates.filter((t) => t.id !== id);
            return {
              templates,
              selectedId: s.selectedId === id ? (templates[0]?.id ?? null) : s.selectedId,
              selectedSlotId: null,
            };
          }),

        select: (selectedId) => set({ selectedId, selectedSlotId: null }),
        selectSlot: (selectedSlotId) => set({ selectedSlotId }),

        addSlot: (templateId, slot) => {
          const id = crypto.randomUUID();
          change(templateId, (t) => {
            const last = t.slots.at(-1);
            return {
              ...t,
              slots: [
                ...t.slots,
                {
                  xMm: last ? last.xMm + OFFSET_MM : 10,
                  yMm: last ? last.yMm + OFFSET_MM : 10,
                  ...NEW_SLOT,
                  rotation: 0,
                  ...slot,
                  // Siempre un id nuevo, también al duplicar.
                  id,
                },
              ],
            };
          });
          set({ selectedSlotId: id });
        },

        updateSlot: (templateId, slotId, patch) =>
          change(templateId, (t) => ({
            ...t,
            slots: t.slots.map((s) => (s.id === slotId ? { ...s, ...patch } : s)),
          })),

        removeSlot: (templateId, slotId) => {
          change(templateId, (t) => ({ ...t, slots: t.slots.filter((s) => s.id !== slotId) }));
          set({ selectedSlotId: null });
        },

        duplicateSlot: (templateId, slotId) => {
          const slot = get()
            .templates.find((t) => t.id === templateId)
            ?.slots.find((s) => s.id === slotId);
          if (slot) {
            get().addSlot(templateId, {
              ...slot,
              xMm: slot.xMm + OFFSET_MM,
              yMm: slot.yMm + OFFSET_MM,
            });
          }
        },

        moveSlot: (templateId, slotId, delta) =>
          change(templateId, (t) => {
            const from = t.slots.findIndex((s) => s.id === slotId);
            const to = from + delta;
            if (from === -1 || to < 0 || to >= t.slots.length) return t;
            const slots = [...t.slots];
            [slots[from], slots[to]] = [slots[to], slots[from]];
            return { ...t, slots };
          }),
      };
    },
    {
      name: 'pnp-cards-templates',
      version: 1,
      partialize: (s) => ({ templates: s.templates }),
      merge: (persisted, current) => {
        const p = persisted as { templates?: Record<string, unknown>[] } | undefined;
        return {
          ...current,
          templates: (p?.templates ?? []).map((t) =>
            typeof t.id === 'string' && t.id ? normalizeTemplate(t, t.id) : normalizeTemplate(t),
          ),
        };
      },
    },
  ),
);
