/**
 * localStorage that cannot take the app down.
 *
 * Nine places parsed stored JSON with no guard. One malformed value — a
 * truncated write, a quota error mid-save, a user poking at devtools — and
 * `JSON.parse` throws. In `App.tsx` that throw was inside a `useState`
 * initialiser, so a single bad key would white-screen the entire app on load
 * with no way back short of clearing site data.
 *
 * Storage is also unavailable outright in some contexts: Safari private mode
 * historically threw on write, and a WebView with site data disabled has no
 * localStorage at all. Every call here degrades to a default instead.
 */

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Accessing the property itself can throw when storage is blocked.
    return null;
  }
}

/** Parse a stored JSON value, falling back on anything unexpected. */
export function readJson<T>(key: string, fallback: T): T {
  const store = storage();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    // Corrupt entries are cleared so the failure does not repeat every load.
    try {
      store.removeItem(key);
    } catch {
      /* nothing further we can do */
    }
    return fallback;
  }
}

/** Store a JSON value. Returns false when storage is full or unavailable. */
export function writeJson(key: string, value: unknown): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** A record keyed by event id — the shape every cache in this app uses. */
export function readRecord(key: string): Record<string, string> {
  const value = readJson<unknown>(key, {});
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, string>)
    : {};
}
