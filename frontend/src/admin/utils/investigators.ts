/**
 * Universal investigator normalization utilities for CAM-AI Grants CMS
 * and public portal views.
 * Handles arrays of objects, arrays of strings, comma-delimited strings, null, and legacy formats.
 */

export interface InvestigatorRecord {
  name: string;
  department?: string;
  school?: string;
  [key: string]: unknown;
}

export function normalizeInvestigatorNames(investigators: unknown): string[] {
  if (!investigators) return [];
  if (typeof investigators === 'string') {
    return investigators
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(investigators)) {
    return investigators
      .map((item) => {
        if (!item) return '';
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          return (
            (obj.name as string) ||
            (obj.full_name as string) ||
            (obj.investigator_name as string) ||
            ''
          ).trim();
        }
        return String(item).trim();
      })
      .filter(Boolean);
  }
  return [];
}

export function formatInvestigatorNames(investigators: unknown, fallback: string = ''): string {
  const names = normalizeInvestigatorNames(investigators);
  return names.length > 0 ? names.join(', ') : fallback;
}

export function extractPrimaryPIName(
  principalInvestigator: unknown,
  principalInvestigators: unknown
): string | null {
  if (typeof principalInvestigator === 'string' && principalInvestigator.trim()) {
    return principalInvestigator.trim();
  }
  const names = normalizeInvestigatorNames(principalInvestigators);
  return names.length > 0 ? names[0] : null;
}
