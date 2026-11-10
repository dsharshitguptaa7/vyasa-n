/**
 * ANUDAAN (Yajur Veda) Draft Session Credential Management
 * Strictly utilizes sessionStorage to preserve draft session credentials
 * across tab refreshes (F5) without persisting in permanent localStorage
 * or exposing credentials across browser tabs / shared institutional terminals.
 * 
 * Rules:
 * - Scoped strictly to sessionStorage.
 * - Dedicated key: 'anudaan_draft_auth'.
 * - Cleans up only the dedicated key on submission (never calls sessionStorage.clear()).
 * - Credentials must never be logged or placed in URLs.
 */

export interface AnudaanSessionCredentials {
  applicationId: string;
  applicationNumber: string;
  draftKey: string; // 32-character URL-safe Base64 token (also serves as tracking secret)
  createdAt?: string;
}

const STORAGE_KEY = 'anudaan_draft_auth';

/**
 * Checks whether sessionStorage is available in the current execution context.
 */
export function isSessionStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return false;
    }
    const testKey = '__anudaan_storage_test__';
    window.sessionStorage.setItem(testKey, testKey);
    window.sessionStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves draft credentials into sessionStorage.
 * Returns true on success, false if storage is disabled or quota exceeded.
 */
export function saveDraftSession(credentials: AnudaanSessionCredentials): boolean {
  if (!isSessionStorageAvailable()) {
    return false;
  }

  if (
    !credentials ||
    typeof credentials.applicationId !== 'string' ||
    typeof credentials.applicationNumber !== 'string' ||
    typeof credentials.draftKey !== 'string'
  ) {
    return false;
  }

  try {
    const payload = JSON.stringify({
      applicationId: credentials.applicationId.trim(),
      applicationNumber: credentials.applicationNumber.trim(),
      draftKey: credentials.draftKey.trim(),
      createdAt: credentials.createdAt || new Date().toISOString(),
    });
    window.sessionStorage.setItem(STORAGE_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieves and validates active draft credentials from sessionStorage.
 * Returns null if no valid credentials exist or if data is malformed.
 */
export function getDraftSession(): AnudaanSessionCredentials | null {
  if (!isSessionStorageAvailable()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.applicationId !== 'string' ||
      typeof parsed.applicationNumber !== 'string' ||
      typeof parsed.draftKey !== 'string' ||
      parsed.draftKey.trim().length === 0
    ) {
      // Corrupt session data, clean up immediately
      clearDraftSession();
      return null;
    }

    return {
      applicationId: parsed.applicationId.trim(),
      applicationNumber: parsed.applicationNumber.trim(),
      draftKey: parsed.draftKey.trim(),
      createdAt: parsed.createdAt,
    };
  } catch {
    clearDraftSession();
    return null;
  }
}

/**
 * Checks if an active draft session is stored.
 */
export function hasDraftSession(): boolean {
  return getDraftSession() !== null;
}

/**
 * Explicitly removes ONLY the ANUDAAN draft session key.
 * Strictly avoids calling sessionStorage.clear() to preserve other university session data.
 */
export function clearDraftSession(): void {
  if (!isSessionStorageAvailable()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures
  }
}
