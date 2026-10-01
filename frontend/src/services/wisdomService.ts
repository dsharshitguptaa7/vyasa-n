import { VedaShloka } from '../types/wisdom';

export const LAST_WISDOM_STORAGE_KEY = 'vyasa_last_wisdom_shloka';
export const SHLOKAS_URL = '/data/veda-shlokas.json';

/**
 * Loads the Veda shlokas dataset from public/data/veda-shlokas.json.
 * Fails gracefully returning null if fetch or JSON parsing fails.
 */
export async function loadVedaShlokas(): Promise<VedaShloka[] | null> {
  try {
    const url =
      typeof window !== 'undefined' && window.location?.origin
        ? new URL(SHLOKAS_URL, window.location.origin).toString()
        : SHLOKAS_URL;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[VYASA Wisdom] Failed to fetch shlokas: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('[VYASA Wisdom] Shloka dataset is empty or invalid format.');
      return null;
    }
    return data as VedaShloka[];
  } catch (err) {
    console.warn('[VYASA Wisdom] Network or parsing error loading shlokas:', err);
    return null;
  }
}

/**
 * Selects a shloka dynamically from the list.
 * If more than one shloka is available, excludes the shloka displayed in the
 * last login session (stored in localStorage under vyasa_last_wisdom_shloka).
 * Stores the newly selected shloka ID in localStorage.
 */
export function selectWisdomShloka(
  shlokas: VedaShloka[],
  storage: Storage = localStorage
): VedaShloka | null {
  if (!shlokas || shlokas.length === 0) {
    return null;
  }

  if (shlokas.length === 1) {
    const only = shlokas[0];
    try {
      storage.setItem(LAST_WISDOM_STORAGE_KEY, only.id);
    } catch {
      // Ignore storage errors (private browsing quota)
    }
    return only;
  }

  let lastId: string | null = null;
  try {
    lastId = storage.getItem(LAST_WISDOM_STORAGE_KEY);
  } catch {
    // Ignore
  }

  // Filter out the last displayed shloka ID
  const eligible = lastId
    ? shlokas.filter((s) => s.id !== lastId)
    : shlokas;

  const pool = eligible.length > 0 ? eligible : shlokas;
  const randomIndex = Math.floor(Math.random() * pool.length);
  const selected = pool[randomIndex];

  try {
    storage.setItem(LAST_WISDOM_STORAGE_KEY, selected.id);
  } catch {
    // Ignore
  }

  return selected;
}

/**
 * Convenience helper to fetch and select a shloka in one step.
 */
export async function getNextWisdomShloka(): Promise<VedaShloka | null> {
  const all = await loadVedaShlokas();
  if (!all) return null;
  return selectWisdomShloka(all);
}
