/**
 * Formats API errors and exceptions into clear, dignified, respectful English
 * suitable for scholars, faculty, university staff, and authorities.
 * Shields users from raw database exceptions, stack traces, and 422 strings.
 */
export function formatUserFacingError(error: unknown): string {
  if (error === null || error === undefined) {
    return 'An unexpected issue occurred. Please try again.';
  }

  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : typeof error === 'object' && 'detail' in error
      ? String((error as any).detail)
      : String(error);

  const trimmed = rawMessage.trim();

  // Common HTTP status & validation mappings
  if (trimmed.includes('422') || trimmed.toLowerCase().includes('unprocessable entity')) {
    return 'Please check the required form fields and try again.';
  }
  if (trimmed.includes('401') || trimmed.toLowerCase().includes('unauthorized')) {
    return 'Your session has expired. Please log in again to continue.';
  }
  if (trimmed.includes('403') || trimmed.toLowerCase().includes('forbidden')) {
    return 'You do not have jurisdictional permission to perform this action.';
  }
  if (trimmed.includes('404') || trimmed.toLowerCase().includes('not found')) {
    return 'The requested record could not be found.';
  }
  if (trimmed.includes('500') || trimmed.toLowerCase().includes('internal server error')) {
    return 'The university server encountered a temporary issue. Please try again shortly.';
  }
  if (trimmed.toLowerCase().includes('network error') || trimmed.toLowerCase().includes('failed to fetch')) {
    return 'Network connection issue. Please verify your internet connection and try again.';
  }

  // Remove raw technical prefixes
  let cleaned = trimmed
    .replace(/^Error:\s*/i, '')
    .replace(/^AxiosError:\s*/i, '')
    .replace(/^Exception:\s*/i, '');

  if (cleaned.includes('[object Object]') || !cleaned) {
    return 'An unexpected error occurred while processing this request.';
  }

  return cleaned;
}

/**
 * Translates raw actor identifiers into institutional user-facing labels.
 */
export function formatActorLabel(actor?: string | null): string {
  if (!actor) return 'Participant';
  const upper = actor.trim().toUpperCase();
  if (upper === 'SYSTEM' || upper === 'AI' || upper === 'BOT') {
    return 'Automated System';
  }
  if (upper === 'USER' || upper === 'APPLICANT') {
    return 'Scholar / Applicant';
  }
  if (upper === 'MANAGER') {
    return 'Grievance Manager';
  }
  if (upper === 'ASSISTANT_DEAN') {
    return 'Assistant Dean';
  }
  if (upper === 'ASSOCIATE_DEAN') {
    return 'Associate Dean';
  }
  if (upper === 'DEAN' || upper === 'DEAN_RND') {
    return 'Dean R&D';
  }
  if (upper === 'VICE_CHANCELLOR' || upper === 'VC') {
    return 'Vice Chancellor';
  }
  return actor;
}

/**
 * Formats monetary amounts into Indian Rupee (INR / ₹) with standard locale formatting.
 * Guaranteed safe handling of null, undefined, NaN, or non-numeric strings.
 */
export function formatCurrency(amount?: number | string | null, fallback = '₹0'): string {
  if (amount === null || amount === undefined || amount === '') {
    return fallback;
  }
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(num)) {
    return fallback;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Formats byte counts into human-readable data units (KB, MB, GB),
 * shielding users from raw integer byte counts.
 */
export function formatFileSize(bytes?: number | null, fallback = 'Not available'): string {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) {
    return fallback;
  }
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Safely guards any dynamic value, guaranteeing never returning
 * raw 'undefined', 'null', 'NaN', or '[object Object]'.
 */
export function formatSafeText(val?: unknown, fallback = 'Not provided'): string {
  if (val === null || val === undefined) {
    return fallback;
  }
  if (typeof val === 'number' && isNaN(val)) {
    return fallback;
  }
  const str = String(val).trim();
  if (!str || str === 'null' || str === 'undefined' || str === 'NaN' || str === '[object Object]') {
    return fallback;
  }
  return str;
}

/**
 * Safely formats multi-author lists for publication dockets and directories.
 * e.g. "Dr. A. Sharma, Prof. R. Verma et al."
 */
export function formatAuthorsList(authors?: unknown, maxVisible = 2): string {
  if (!authors) return 'Authors not listed';

  let list: string[] = [];
  if (Array.isArray(authors)) {
    list = authors.map((a) => (typeof a === 'string' ? a.trim() : (a as any)?.name || '')).filter(Boolean);
  } else if (typeof authors === 'string') {
    list = authors.split(/[,;]/).map((a) => a.trim()).filter(Boolean);
  }

  if (list.length === 0) return 'Authors not listed';
  if (list.length <= maxVisible) return list.join(', ');

  const visible = list.slice(0, maxVisible).join(', ');
  const remaining = list.length - maxVisible;
  return `${visible} +${remaining} more`;
}

