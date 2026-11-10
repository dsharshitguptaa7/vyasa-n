import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveDraftSession,
  getDraftSession,
  clearDraftSession,
  hasDraftSession,
  isSessionStorageAvailable,
} from '../services/anudaanSession';

describe('ANUDAAN Draft Session Management (anudaanSession)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('1. Detects sessionStorage availability in jsdom', () => {
    expect(isSessionStorageAvailable()).toBe(true);
  });

  it('2. Saves valid draft credentials and retrieves them cleanly', () => {
    const creds = {
      applicationId: '01d12825-9dda-4775-aa02-ff6a07254c47',
      applicationNumber: 'ANU-2026-A1B2C',
      draftKey: 'eG7Y-mZ9_1kL8oP4qR2sT0uV3wX5yZ6A',
    };

    const saved = saveDraftSession(creds);
    expect(saved).toBe(true);
    expect(hasDraftSession()).toBe(true);

    const retrieved = getDraftSession();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.applicationId).toBe(creds.applicationId);
    expect(retrieved?.applicationNumber).toBe(creds.applicationNumber);
    expect(retrieved?.draftKey).toBe(creds.draftKey);
    expect(retrieved?.createdAt).toBeDefined();
  });

  it('3. Clears ONLY the ANUDAAN session key, preserving unrelated session data', () => {
    // Set other university session item
    window.sessionStorage.setItem('vyasa_active_pillar', 'yajur-veda');
    window.sessionStorage.setItem('other_user_token', 'xyz-123');

    // Save ANUDAAN session
    saveDraftSession({
      applicationId: 'app-1',
      applicationNumber: 'ANU-2026-00001',
      draftKey: 'secret-token-key-32-chars-long!',
    });

    expect(hasDraftSession()).toBe(true);

    // Clear ANUDAAN session
    clearDraftSession();

    expect(hasDraftSession()).toBe(false);
    expect(getDraftSession()).toBeNull();

    // Verify other keys remain intact
    expect(window.sessionStorage.getItem('vyasa_active_pillar')).toBe('yajur-veda');
    expect(window.sessionStorage.getItem('other_user_token')).toBe('xyz-123');
  });

  it('4. Rejects malformed or incomplete credentials without crashing', () => {
    // @ts-expect-error Testing invalid input
    expect(saveDraftSession(null)).toBe(false);
    // @ts-expect-error Testing invalid input
    expect(saveDraftSession({ applicationId: '' })).toBe(false);

    // Corrupt data in storage directly
    window.sessionStorage.setItem('anudaan_draft_auth', '{ invalid-json');
    expect(getDraftSession()).toBeNull();
    expect(hasDraftSession()).toBe(false);

    // Missing key in storage directly
    window.sessionStorage.setItem(
      'anudaan_draft_auth',
      JSON.stringify({ applicationId: '123', draftKey: '' })
    );
    expect(getDraftSession()).toBeNull();
  });
});
