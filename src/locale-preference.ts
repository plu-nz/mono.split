export type SharedPreference = 'en' | 'pt' | 'es' | 'system';

const COOKIE_NAME = 'plunz_locale';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

function isPreference(value: unknown): value is SharedPreference {
  return value === 'en' || value === 'pt' || value === 'es' || value === 'system';
}

function isPlunzHost(): boolean {
  if (typeof location === 'undefined') return false;
  return location.hostname === 'plu.nz' || location.hostname.endsWith('.plu.nz');
}

function readCookie(): SharedPreference | undefined {
  if (!isPlunzHost() || typeof document === 'undefined') return undefined;
  try {
    const entry = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`));
    const value = entry?.slice(COOKIE_NAME.length + 1);
    return isPreference(value) ? value : undefined;
  } catch { return undefined; }
}

function writeCookie(preference: SharedPreference): void {
  if (!isPlunzHost() || typeof document === 'undefined') return;
  try {
    document.cookie = `${COOKIE_NAME}=${preference}; Domain=plu.nz; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
  } catch { /* Storage can be disabled by the browser. */ }
}

export function readSharedPreference(storage: Storage | undefined, legacyKey: string): SharedPreference {
  const shared = readCookie();
  if (shared) {
    try { storage?.setItem(legacyKey, shared); } catch { /* Keep the shared preference. */ }
    return shared;
  }
  let local: string | null | undefined;
  try { local = storage?.getItem(legacyKey); } catch { /* Use the system language. */ }
  if (isPreference(local)) {
    // Migrate an existing explicit choice on the first visit to a PLUNZ host.
    if (local !== 'system') writeCookie(local);
    return local;
  }
  return 'system';
}

export function writeSharedPreference(storage: Storage | undefined, legacyKey: string, preference: SharedPreference): void {
  try { storage?.setItem(legacyKey, preference); } catch { /* The cookie can still persist. */ }
  writeCookie(preference);
}
