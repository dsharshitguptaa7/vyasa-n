/**
 * Centralized Institutional Timezone & DateTime Utilities for VYASA + NIVARAN.
 *
 * Institutional Business Timezone: Asia/Kolkata (IST / UTC+05:30)
 * All client-rendered institutional timestamps must strictly enforce Asia/Kolkata
 * so that users, regardless of browser locale or physical location, view dates
 * and times identically according to University Standard Time.
 */

export const INSTITUTIONAL_TIMEZONE = 'Asia/Kolkata';
export const INSTITUTIONAL_TZ_LABEL = 'IST (UTC+05:30)';

/**
 * Normalizes input date to a valid JavaScript Date instance.
 */
export function toValidDate(date: string | number | Date): Date {
  if (date instanceof Date) {
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid Date instance provided`);
    }
    return date;
  }

  if (typeof date === 'number') {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid numeric timestamp: ${date}`);
    }
    return d;
  }

  if (typeof date === 'string') {
    const trimmed = date.trim();
    if (!trimmed) {
      throw new Error(`Empty date string provided`);
    }
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) {
      throw new Error(`Unable to parse date string: "${date}"`);
    }
    return d;
  }

  throw new Error(`Unsupported date type: ${typeof date}`);
}

/**
 * Formats a date in Asia/Kolkata (IST) timezone.
 *
 * Example: "28 Sep 2026" or "September 28, 2026"
 */
export function formatDateIST(
  date: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (date === null || date === undefined || date === '') return '';

  try {
    const d = toValidDate(date);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: INSTITUTIONAL_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };

    return new Intl.DateTimeFormat('en-IN', {
      ...defaultOptions,
      ...options,
      timeZone: INSTITUTIONAL_TIMEZONE, // Hard-enforce IST
    }).format(d);
  } catch (err) {
    console.error('[formatDateIST] Formatting error:', err);
    return 'Invalid Date';
  }
}

/**
 * Formats a time in Asia/Kolkata (IST) timezone.
 *
 * Example: "07:30:00 AM IST"
 */
export function formatTimeIST(
  date: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (date === null || date === undefined || date === '') return '';

  try {
    const d = toValidDate(date);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: INSTITUTIONAL_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    };

    return new Intl.DateTimeFormat('en-IN', {
      ...defaultOptions,
      ...options,
      timeZone: INSTITUTIONAL_TIMEZONE, // Hard-enforce IST
    }).format(d);
  } catch (err) {
    console.error('[formatTimeIST] Formatting error:', err);
    return 'Invalid Time';
  }
}

/**
 * Formats both date and time in Asia/Kolkata (IST) timezone.
 *
 * Example: "28 Sep 2026, 07:30 AM IST"
 */
export function formatDateTimeIST(
  date: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (date === null || date === undefined || date === '') return '';

  try {
    const d = toValidDate(date);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: INSTITUTIONAL_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    };

    const formatted = new Intl.DateTimeFormat('en-IN', {
      ...defaultOptions,
      ...options,
      timeZone: INSTITUTIONAL_TIMEZONE, // Hard-enforce IST
    }).format(d);

    return `${formatted} IST`;
  } catch (err) {
    console.error('[formatDateTimeIST] Formatting error:', err);
    return 'Invalid Date/Time';
  }
}

/**
 * Formats a relative time description comparing the given date to now in IST.
 *
 * Example: "just now", "15m ago", "2h ago", "yesterday", or formatted IST date.
 */
export function formatRelativeTimeIST(date: string | number | Date | null | undefined): string {
  if (date === null || date === undefined || date === '') return '';

  try {
    const d = toValidDate(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();

    // Future dates
    if (diffMs < 0) {
      return formatDateIST(d);
    }

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return 'just now';
    }
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays === 1) {
      return 'yesterday';
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    return formatDateIST(d);
  } catch (err) {
    console.error('[formatRelativeTimeIST] Formatting error:', err);
    return 'Invalid Date';
  }
}
