import type { Template } from '../../lib/template';
import { useSettingsStore } from '../../store/settingsStore';
import { useTemplatesStore } from './templatesStore';

const store = () => useTemplatesStore.getState();

const template = (): Template => ({
  id: 't1',
  name: 'Caja',
  pageMm: { width: 210, height: 297 },
  slots: [
    { id: 'a', xMm: 10, yMm: 10, widthMm: 63, heightMm: 88, rotation: 0 },
    { id: 'b', xMm: 80, yMm: 10, widthMm: 63, heightMm: 88, rotation: 0 },
  ],
});

beforeEach(() => {
  useTemplatesStore.setState({ templates: [], selectedId: null, selectedSlotId: null });
  useSettingsStore.getState().reset();
});

describe('templatesStore', () => {
  it('al añadir una plantilla la selecciona junto con su primer hueco', () => {
    store().add(template());
    expect(store().selectedId).toBe('t1');
    expect(store().selectedSlotId).toBe('a');
  });

  it('un hueco nuevo es de 63 × 88 mm, un poco desplazado del último', () => {
    store().add(template());
    store().addSlot('t1');
    const slot = store().templates[0].slots[2];
    expect(slot).toMatchObject({ xMm: 85, yMm: 15, widthMm: 63, heightMm: 88, rotation: 0 });
    expect(store().selectedSlotId).toBe(slot.id);
  });

  it('cambia el orden de relleno de los huecos', () => {
    store().add(template());
    store().moveSlot('t1', 'b', -1);
    expect(store().templates[0].slots.map((s) => s.id)).toEqual(['b', 'a']);
    store().moveSlot('t1', 'b', -1);
    expect(store().templates[0].slots.map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('duplica y borra huecos', () => {
    store().add(template());
    store().duplicateSlot('t1', 'a');
    expect(store().templates[0].slots[2]).toMatchObject({ xMm: 15, yMm: 15 });
    store().removeSlot('t1', 'a');
    expect(store().templates[0].slots).toHaveLength(2);
  });

  it('si Cartas usa la plantilla, sus cambios llegan también a los ajustes', () => {
    store().add(template());
    useSettingsStore.getState().update({ mode: 'template', template: template() });
    store().updateSlot('t1', 'a', { rotation: 90 });
    expect(useSettingsStore.getState().settings.template?.slots[0].rotation).toBe(90);
  });
});
