import { DEFAULT_SETTINGS, mergeSettings } from '../lib/settings';
import { useSettingsStore } from './settingsStore';

describe('settingsStore', () => {
  beforeEach(() => useSettingsStore.getState().reset());

  it('empieza con los valores por defecto de PDFCartas', () => {
    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(useSettingsStore.getState().openAfter).toBe(true);
  });

  it('actualiza parte de la configuración', () => {
    useSettingsStore.getState().update({ marginMm: 5 });
    useSettingsStore.getState().update({ bleed: { enabled: true, mm: 3, color: '#ff0000' } });
    const s = useSettingsStore.getState().settings;
    expect(s.marginMm).toBe(5);
    expect(s.bleed).toEqual({ enabled: true, mm: 3, color: '#ff0000' });
    expect(s.mode).toBe('vertical9');
  });

  it('al cargar una configuración guardada incompleta, completa lo que falta', () => {
    const merged = mergeSettings({ marginMm: 3, crop: { enabled: true } });
    expect(merged.marginMm).toBe(3);
    expect(merged.crop).toEqual({ ...DEFAULT_SETTINGS.crop, enabled: true });
    expect(merged.cutLines).toEqual(DEFAULT_SETTINGS.cutLines);
  });
});
