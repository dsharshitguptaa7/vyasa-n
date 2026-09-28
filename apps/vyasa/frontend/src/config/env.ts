export interface FrontendConfig {
  apiBaseUrl: string;
  appName: string;
  appTagline: string;
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

export const config: FrontendConfig = {
  apiBaseUrl: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'),
  appName: import.meta.env.VITE_APP_NAME || 'VYASA',
  appTagline: import.meta.env.VITE_APP_TAGLINE || 'Research & Governance Ecosystem',
};
