import { describe, it, expect } from 'vitest';
import {
  formatDateIST,
  formatTimeIST,
  formatDateTimeIST,
  formatRelativeTimeIST,
  INSTITUTIONAL_TIMEZONE,
  INSTITUTIONAL_TZ_LABEL,
  toValidDate,
} from '@vyasa/ui';

describe('Institutional Timezone & DateTime Utilities (Asia/Kolkata)', () => {
  it('exports correct institutional timezone constants', () => {
    expect(INSTITUTIONAL_TIMEZONE).toBe('Asia/Kolkata');
    expect(INSTITUTIONAL_TZ_LABEL).toBe('IST (UTC+05:30)');
  });

  describe('formatDateIST', () => {
    it('correctly shifts UTC instant across midnight to next calendar day in IST', () => {
      // 2026-09-27 19:00:00 UTC = 2026-09-28 00:30:00 IST (+05:30)
      const utcInstant = '2026-09-27T19:00:00Z';
      const formatted = formatDateIST(utcInstant);
      expect(formatted).toContain('28');
      expect(formatted).toContain('Sep');
      expect(formatted).toContain('2026');
    });

    it('correctly preserves previous calendar day when UTC instant is before 18:30 UTC', () => {
      // 2026-09-27 18:29:59 UTC = 2026-09-27 23:59:59 IST
      const utcInstant = '2026-09-27T18:29:59Z';
      const formatted = formatDateIST(utcInstant);
      expect(formatted).toContain('27');
      expect(formatted).toContain('Sep');
      expect(formatted).toContain('2026');
    });

    it('returns empty string for null or undefined input', () => {
      expect(formatDateIST(null)).toBe('');
      expect(formatDateIST(undefined)).toBe('');
    });

    it('handles numeric epoch timestamps safely', () => {
      // Epoch 0 = 1970-01-01 05:30:00 IST
      const formatted = formatDateIST(0);
      expect(formatted).toContain('1');
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('1970');
    });
  });

  describe('formatTimeIST', () => {
    it('formats time strictly according to Asia/Kolkata timezone', () => {
      // 2026-09-28 04:00:00 UTC = 2026-09-28 09:30:00 AM IST
      const utcInstant = '2026-09-28T04:00:00Z';
      const formatted = formatTimeIST(utcInstant);
      expect(formatted).toMatch(/09:30:00\s*(am|AM)/i);
    });

    it('returns empty string for empty input', () => {
      expect(formatTimeIST(null)).toBe('');
    });
  });

  describe('formatDateTimeIST', () => {
    it('formats full institutional timestamp with explicit IST suffix', () => {
      const utcInstant = '2026-09-28T07:15:00Z'; // 12:45 PM IST
      const formatted = formatDateTimeIST(utcInstant);
      expect(formatted).toContain('28');
      expect(formatted).toContain('Sep');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('12:45');
      expect(formatted.endsWith('IST')).toBe(true);
    });
  });

  describe('formatRelativeTimeIST', () => {
    it('returns "just now" for very recent instants', () => {
      const justNow = new Date(Date.now() - 5000); // 5 seconds ago
      expect(formatRelativeTimeIST(justNow)).toBe('just now');
    });

    it('returns minutes ago for timestamps under an hour', () => {
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
      expect(formatRelativeTimeIST(tenMinsAgo)).toBe('10m ago');
    });
  });

  describe('toValidDate validation', () => {
    it('validates and parses valid dates', () => {
      const d = toValidDate('2026-09-28T10:00:00Z');
      expect(d instanceof Date).toBe(true);
      expect(isNaN(d.getTime())).toBe(false);
    });

    it('throws descriptive error on malformed string', () => {
      expect(() => toValidDate('not-a-valid-date')).toThrow();
    });
  });
});
