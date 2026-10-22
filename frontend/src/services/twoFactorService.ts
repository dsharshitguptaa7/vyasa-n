import { config } from '../config';
import {
  TokenResponse,
  TwoFactorSetupDetails,
  TwoFactorStatus,
} from '../types/auth';
import { authService, AuthError } from './authService';

export const TWO_FACTOR_STORAGE_KEY = 'vyasa_2fa_challenge';

export const twoFactorService = {
  getStoredChallenge(): { challenge_id: string; two_factor_setup_required: boolean } | null {
    try {
      const raw = sessionStorage.getItem(TWO_FACTOR_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setStoredChallenge(challenge: { challenge_id: string; two_factor_setup_required: boolean }): void {
    try {
      sessionStorage.setItem(TWO_FACTOR_STORAGE_KEY, JSON.stringify(challenge));
    } catch {
      // Storage unavailable fallback
    }
  },

  clearStoredChallenge(): void {
    try {
      sessionStorage.removeItem(TWO_FACTOR_STORAGE_KEY);
    } catch {
      // Storage unavailable fallback
    }
  },

  async getSetupDetails(challengeId: string): Promise<TwoFactorSetupDetails> {
    const url = `${config.apiBaseUrl}/auth/2fa/setup`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new AuthError(
          data?.message || data?.detail || 'Failed to load two-factor enrollment details. Please sign in again.',
          response.status
        );
      }
      return data as TwoFactorSetupDetails;
    } catch (err: unknown) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('Unable to connect to VYASA institutional two-factor service.');
    }
  },

  async confirmSetup(challengeId: string, code: string): Promise<TokenResponse> {
    const url = `${config.apiBaseUrl}/auth/2fa/confirm-setup`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, code: code.trim() }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new AuthError(
          data?.message || data?.detail || 'Invalid or expired verification code. Please try again.',
          response.status
        );
      }

      if (data?.access_token) {
        authService.setToken(data.access_token);
      }
      this.clearStoredChallenge();
      return data as TokenResponse;
    } catch (err: unknown) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('Unable to complete two-factor enrollment. Please try again.');
    }
  },

  async verifyLogin(challengeId: string, code: string): Promise<TokenResponse> {
    const url = `${config.apiBaseUrl}/auth/2fa/verify`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, code: code.trim() }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new AuthError(
          data?.message || data?.detail || 'Invalid or expired verification code.',
          response.status
        );
      }

      if (data?.access_token) {
        authService.setToken(data.access_token);
      }
      this.clearStoredChallenge();
      return data as TokenResponse;
    } catch (err: unknown) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('Unable to verify authenticator code. Please try again.');
    }
  },

  async verifyRecovery(challengeId: string, recoveryCode: string): Promise<TokenResponse> {
    const url = `${config.apiBaseUrl}/auth/2fa/recovery`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, recovery_code: recoveryCode.trim() }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new AuthError(
          data?.message || data?.detail || 'Invalid or already consumed backup recovery code.',
          response.status
        );
      }

      if (data?.access_token) {
        authService.setToken(data.access_token);
      }
      this.clearStoredChallenge();
      return data as TokenResponse;
    } catch (err: unknown) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('Unable to verify recovery code. Please try again.');
    }
  },

  async getStatus(): Promise<TwoFactorStatus> {
    const token = authService.getToken();
    if (!token) throw new AuthError('No active session found.', 401);

    const url = `${config.apiBaseUrl}/auth/2fa/status`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new AuthError(data?.message || data?.detail || 'Failed to fetch 2FA status.', response.status);
      }
      return data as TwoFactorStatus;
    } catch (err: unknown) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('Unable to connect to VYASA 2FA service.');
    }
  },

  async regenerateRecoveryCodes(password: string, code: string): Promise<string[]> {
    const token = authService.getToken();
    if (!token) throw new AuthError('No active session found.', 401);

    const url = `${config.apiBaseUrl}/auth/2fa/recovery-codes/regenerate`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password, code: code.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new AuthError(data?.message || data?.detail || 'Failed to regenerate recovery codes.', response.status);
      }
      return (data?.recovery_codes || []) as string[];
    } catch (err: unknown) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('Unable to regenerate recovery codes.');
    }
  },
};
