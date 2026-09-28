import { config } from '../config';
import {
  ApplicantRegisterPayload,
  ApplicantRegisterResponse,
  AuthenticatedUser,
  SubjectItem,
  TokenResponse,
} from '../types/auth';

export const TOKEN_STORAGE_KEY = 'vyasa_access_token';

export class AuthError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 0) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

export const authService = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },

  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // Storage unavailable fallback
    }
  },

  removeToken(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Storage unavailable fallback
    }
  },

  async login(email: string, password: string): Promise<TokenResponse> {
    const url = `${config.apiBaseUrl}/auth/login`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          throw new AuthError('Invalid institutional credentials. Please check your email and password.', 401);
        }
        if (response.status === 403) {
          throw new AuthError('Account deactivated. Please contact an institutional administrator.', 403);
        }
        if (response.status === 422) {
          throw new AuthError('Please provide a valid institutional email and security credential.', 422);
        }
        throw new AuthError(
          data?.message || data?.detail || 'Authentication service error. Please try again later.',
          response.status
        );
      }

      if (!data?.access_token) {
        throw new AuthError('Invalid response received from identity service.', 500);
      }

      this.setToken(data.access_token);
      return data as TokenResponse;
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        throw err;
      }
      throw new AuthError(
        'Unable to connect to VYASA institutional identity service. Please verify your network connection.'
      );
    }
  },

  async getCurrentUser(): Promise<AuthenticatedUser> {
    const token = this.getToken();
    if (!token) {
      throw new AuthError('No active session found.', 401);
    }

    const url = `${config.apiBaseUrl}/auth/me`;

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
        if (response.status === 401 || response.status === 403) {
          this.removeToken();
          throw new AuthError('Session expired or unauthorized. Please sign in again.', response.status);
        }
        throw new AuthError(
          data?.message || data?.detail || 'Failed to verify authority profile.',
          response.status
        );
      }

      return data as AuthenticatedUser;
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        throw err;
      }
      throw new AuthError('Unable to connect to VYASA identity service.');
    }
  },

  async getSubjects(): Promise<SubjectItem[]> {
    const url = `${config.apiBaseUrl}/auth/subjects`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new AuthError(data?.message || data?.detail || 'Failed to load institutional subjects.', response.status);
      }
      return (data || []) as SubjectItem[];
    } catch (err: unknown) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('Unable to connect to VYASA institutional catalog service.');
    }
  },

  async register(payload: ApplicantRegisterPayload): Promise<ApplicantRegisterResponse> {
    const url = `${config.apiBaseUrl}/auth/register`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409) {
          throw new AuthError(data?.message || data?.detail || 'An account with this email or PhD registration already exists.', 409);
        }
        if (response.status === 422) {
          const detailMsg = Array.isArray(data?.error?.details)
            ? data.error.details.map((d: any) => d.msg).join(', ')
            : data?.message || data?.detail || 'Please verify the submitted information.';
          throw new AuthError(detailMsg, 422);
        }
        throw new AuthError(data?.message || data?.detail || 'Registration failed. Please try again.', response.status);
      }
      return data as ApplicantRegisterResponse;
    } catch (err: unknown) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('Unable to connect to VYASA applicant registration service.');
    }
  },

  logout(): void {
    this.removeToken();
  },
};
