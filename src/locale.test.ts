import { describe, expect, test, vi } from 'vitest';
import { detectLocale, readPreference, savePreference } from './locale';

describe('language preferences', () => {
  test('uses the first supported browser language and English as fallback', () => {
    expect(detectLocale(['fr-CA', 'es-MX', 'pt-BR'])).toBe('es');
    expect(detectLocale(['pt-BR'])).toBe('pt');
    expect(detectLocale(['ja-JP'])).toBe('en');
  });

  test('persists a manual choice and restores system selection', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    expect(readPreference()).toBe('system');
    savePreference('pt');
    expect(readPreference()).toBe('pt');
    savePreference('system');
    expect(readPreference()).toBe('system');
    vi.unstubAllGlobals();
  });
});
