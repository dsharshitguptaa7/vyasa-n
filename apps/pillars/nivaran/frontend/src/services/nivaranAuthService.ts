import {
  AuthoritySessionResponse,
  ApplicantSessionResponse,
  UnifiedSessionResponse,
  AuthorityErrorState,
} from '../types/authority';

const TOKEN_KEY = 'nivaran_access_token';
const API_BASE_URL = (import.meta.env?.VITE_NIVARAN_API_BASE_URL as string) || 'http://localhost:8001/api/v1';

export class NivaranAuthService {
  static getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  static setToken(token: string): void {
    try {
      const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
      localStorage.setItem(TOKEN_KEY, cleanToken);
    } catch {
      // ignore
    }
  }

  static clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('nivaran_target_role');
    } catch {
      // ignore
    }
  }

  static async fetchAuthoritySession(token: string): Promise<AuthoritySessionResponse> {
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    const url = `${API_BASE_URL}/authority/me`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Accept': 'application/json',
        },
      });
    } catch (networkErr: unknown) {
      const errState: AuthorityErrorState = {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to the NIVARAN backend service.',
        detail: networkErr instanceof Error ? networkErr.message : 'Network communication failed',
      };
      throw errState;
    }

    if (!response.ok) {
      let errorBody: { detail?: string } = {};
      try {
        errorBody = await response.json();
      } catch {
        // non-JSON response
      }

      const detail = errorBody.detail || response.statusText;
      const status = response.status;

      let code: AuthorityErrorState['code'] = 'UNKNOWN_ERROR';

      if (status === 401) {
        if (detail.toLowerCase().includes('unreachable') || detail.toLowerCase().includes('identity authority')) {
          code = 'VYASA_UNREACHABLE';
        } else {
          code = 'INVALID_TOKEN';
        }
      } else if (status === 403) {
        if (detail.toLowerCase().includes('no nivaran authority profile') || detail.toLowerCase().includes('unmapped')) {
          code = 'UNMAPPED_AUTHORITY';
        } else if (detail.toLowerCase().includes('applicant') || detail.toLowerCase().includes('ecosystem role')) {
          code = 'FORBIDDEN_ROLE';
        } else {
          code = 'UNMAPPED_AUTHORITY';
        }
      } else if (status === 503) {
        code = 'VYASA_UNREACHABLE';
      }

      const errState: AuthorityErrorState = {
        code,
        status,
        message: detail,
        detail,
      };
      throw errState;
    }

    return (await response.json()) as AuthoritySessionResponse;
  }

  static async fetchApplicantSession(token: string): Promise<ApplicantSessionResponse> {
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    const url = `${API_BASE_URL}/applicant/session`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Accept': 'application/json',
        },
      });
    } catch (networkErr: unknown) {
      const errState: AuthorityErrorState = {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to the NIVARAN backend service.',
        detail: networkErr instanceof Error ? networkErr.message : 'Network communication failed',
      };
      throw errState;
    }

    if (!response.ok) {
      let errorBody: { detail?: string } = {};
      try {
        errorBody = await response.json();
      } catch {
        // non-JSON response
      }

      const detail = errorBody.detail || response.statusText;
      const status = response.status;

      let code: AuthorityErrorState['code'] = 'UNKNOWN_ERROR';
      if (status === 401) {
        if (detail.toLowerCase().includes('unreachable') || detail.toLowerCase().includes('identity authority')) {
          code = 'VYASA_UNREACHABLE';
        } else {
          code = 'INVALID_TOKEN';
        }
      } else if (status === 403) {
        code = 'FORBIDDEN_ROLE';
      } else if (status === 503) {
        code = 'VYASA_UNREACHABLE';
      }

      const errState: AuthorityErrorState = {
        code,
        status,
        message: detail,
        detail,
      };
      throw errState;
    }

    return (await response.json()) as ApplicantSessionResponse;
  }

  static async fetchUnifiedSession(token: string): Promise<UnifiedSessionResponse> {
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    const url = `${API_BASE_URL}/session`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Accept': 'application/json',
        },
      });
    } catch (networkErr: unknown) {
      const errState: AuthorityErrorState = {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to the NIVARAN backend service.',
        detail: networkErr instanceof Error ? networkErr.message : 'Network communication failed',
      };
      throw errState;
    }

    if (!response.ok) {
      let errorBody: { detail?: string } = {};
      try {
        errorBody = await response.json();
      } catch {
        // non-JSON response
      }

      const detail = errorBody.detail || response.statusText;
      const status = response.status;

      let code: AuthorityErrorState['code'] = 'UNKNOWN_ERROR';
      if (status === 401) {
        if (detail.toLowerCase().includes('unreachable') || detail.toLowerCase().includes('identity authority')) {
          code = 'VYASA_UNREACHABLE';
        } else {
          code = 'INVALID_TOKEN';
        }
      } else if (status === 403) {
        code = 'FORBIDDEN_ROLE';
      } else if (status === 503) {
        code = 'VYASA_UNREACHABLE';
      }

      const errState: AuthorityErrorState = {
        code,
        status,
        message: detail,
        detail,
      };
      throw errState;
    }

    return (await response.json()) as UnifiedSessionResponse;
  }

  static async resolveSession(token: string): Promise<UnifiedSessionResponse> {
    try {
      const authSession = await NivaranAuthService.fetchAuthoritySession(token);
      return { success: true, role_type: 'authority', session: authSession };
    } catch (err: unknown) {
      const errState = err as AuthorityErrorState;
      // If forbidden from authority endpoint, try resolving as applicant
      if (
        errState.code === 'FORBIDDEN_ROLE' ||
        errState.status === 403 ||
        errState.message?.toLowerCase().includes('applicant') ||
        errState.message?.toLowerCase().includes('ecosystem role')
      ) {
        const applicantSession = await NivaranAuthService.fetchApplicantSession(token);
        return { success: true, role_type: 'applicant', session: applicantSession };
      }
      throw err;
    }
  }
}
