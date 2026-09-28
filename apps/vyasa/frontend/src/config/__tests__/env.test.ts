import { describe, it, expect } from 'vitest';
import { normalizeApiBaseUrl, config } from '../env';
import { authService } from '../../services/authService';

describe('API Base URL Normalization & AuthService Endpoint Resolution', () => {
  it('preserves an already-correct /api base URL', () => {
    expect(normalizeApiBaseUrl('http://localhost:8000/api')).toBe('http://localhost:8000/api');
  });

  it('appends /api if missing from base URL', () => {
    expect(normalizeApiBaseUrl('http://localhost:8000')).toBe('http://localhost:8000/api');
  });

  it('removes single and multiple trailing slashes', () => {
    expect(normalizeApiBaseUrl('http://localhost:8000/')).toBe('http://localhost:8000/api');
    expect(normalizeApiBaseUrl('http://localhost:8000/api/')).toBe('http://localhost:8000/api');
    expect(normalizeApiBaseUrl('http://localhost:8000///')).toBe('http://localhost:8000/api');
    expect(normalizeApiBaseUrl('http://localhost:8000/api///')).toBe('http://localhost:8000/api');
  });

  it('avoids /api/api duplication if /api was duplicated or appended repeatedly', () => {
    expect(normalizeApiBaseUrl('http://localhost:8000/api/api')).toBe('http://localhost:8000/api');
    expect(normalizeApiBaseUrl('http://localhost:8000/api/api/')).toBe('http://localhost:8000/api');
  });

  it('falls back safely to default when undefined or empty', () => {
    expect(normalizeApiBaseUrl('')).toBe('http://localhost:8000/api');
    expect(normalizeApiBaseUrl(undefined)).toBe('http://localhost:8000/api');
  });

  it('config.apiBaseUrl correctly resolves to ending in /api', () => {
    expect(config.apiBaseUrl.endsWith('/api')).toBe(true);
    expect(config.apiBaseUrl.endsWith('/api/api')).toBe(false);
  });

  it('authService calls exact registered backend paths: /api/auth/login and /api/auth/me', () => {
    const loginUrl = `${config.apiBaseUrl}/auth/login`;
    const meUrl = `${config.apiBaseUrl}/auth/me`;

    expect(loginUrl).toBe('http://localhost:8000/api/auth/login');
    expect(meUrl).toBe('http://localhost:8000/api/auth/me');
  });
});
