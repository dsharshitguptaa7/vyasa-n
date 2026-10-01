export interface FrontendConfig {
  apiBaseUrl: string;
  appName: string;
  appTagline: string;
  nivaranAppUrl: string;
  nivaranOrigin: string;
}

/**
 * Normalizes an API base URL to ensure:
 * - Trailing slashes are removed
 * - Ends with `/api`
 * - Avoids `/api/api` duplication
 * - Preserves an already-correct `/api`
 */
export function normalizeApiBaseUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return 'http://localhost:8000/api';
  }

  // Remove leading/trailing whitespace and any trailing slashes
  let cleaned = rawUrl.trim().replace(/\/+$/, '');

  // Remove duplicate /api/api instances if present
  while (cleaned.endsWith('/api/api')) {
    cleaned = cleaned.slice(0, -4);
  }

  // Preserve already-correct /api suffix
  if (cleaned.endsWith('/api')) {
    return cleaned;
  }

  // Append /api if missing
  return `${cleaned}/api`;
}

/**
 * Resolves the configured NIVARAN application URL.
 * Falls back to local development URL (http://localhost:5174) if not set.
 */
export function resolveNivaranUrl(rawUrl?: string): string {
  const url = (rawUrl !== undefined ? rawUrl : import.meta.env.VITE_NIVARAN_APP_URL) || 'http://localhost:5174';
  const trimmed = url.trim();
  return trimmed || 'http://localhost:5174';
}

/**
 * Derives the origin (protocol + host + port) from the configured NIVARAN application URL.
 * Strictly used for window postMessage origin targeting and listener validation.
 */
export function resolveNivaranOrigin(rawUrl?: string): string {
  const targetUrl = resolveNivaranUrl(rawUrl);
  try {
    return new URL(targetUrl).origin;
  } catch {
    return 'http://localhost:5174';
  }
}

export const config: FrontendConfig = {
  apiBaseUrl: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'),
  appName: import.meta.env.VITE_APP_NAME || 'VYASA',
  appTagline: import.meta.env.VITE_APP_TAGLINE || 'Research & Governance Ecosystem',
  nivaranAppUrl: resolveNivaranUrl(),
  nivaranOrigin: resolveNivaranOrigin(),
};

