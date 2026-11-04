import { afterEach, describe, expect, test, vi } from 'vitest';
import { readSharedPreference, writeSharedPreference } from './locale-preference';

function browser(initialCookie = '') {
  let cookie = initialCookie;
  vi.stubGlobal('location', { hostname: 'split.plu.nz' });
  vi.stubGlobal('document', {
    get cookie() { return cookie; },
    set cookie(value: string) { cookie = value.split(';', 1)[0]; },
  });
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  } as Storage;
  return { storage, values, cookie: () => cookie };
}

afterEach(() => vi.unstubAllGlobals());

describe('shared PLUNZ language preference', () => {
  test('migrates a legacy choice into a domain cookie', () => {
    const { storage, values, cookie } = browser();
    values.set('old.locale', 'pt');
    expect(readSharedPreference(storage, 'old.locale')).toBe('pt');
    expect(cookie()).toBe('plunz_locale=pt');
  });

  test('a shared choice overrides and updates a stale app choice', () => {
    const { storage, values } = browser('plunz_locale=es');
    values.set('old.locale', 'pt');
    expect(readSharedPreference(storage, 'old.locale')).toBe('es');
    expect(values.get('old.locale')).toBe('es');
  });

  test('system preference blocks an old local choice from returning', () => {
    const { storage, values, cookie } = browser();
    values.set('old.locale', 'pt');
    writeSharedPreference(storage, 'old.locale', 'system');
    expect(cookie()).toBe('plunz_locale=system');
    expect(readSharedPreference(storage, 'old.locale')).toBe('system');
    expect(values.get('old.locale')).toBe('system');
  });
});
