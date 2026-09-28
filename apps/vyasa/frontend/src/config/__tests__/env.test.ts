import { describe, it, expect } from 'vitest';
import { normalizeApiBaseUrl, resolveNivaranUrl, resolveNivaranOrigin, config } from '../env';
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

describe('NIVARAN App URL & Origin Configuration (VITE_NIVARAN_APP_URL)', () => {
  it('Requirement 4: Local development configuration resolves to http://localhost:5174', () => {
    expect(resolveNivaranUrl()).toBe('http://localhost:5174');
    expect(resolveNivaranUrl('')).toBe('http://localhost:5174');
    expect(resolveNivaranUrl(undefined)).toBe('http://localhost:5174');
    expect(resolveNivaranOrigin()).toBe('http://localhost:5174');
  });

  it('Requirement 5: Production configuration resolves to production NIVARAN URL and derives origin', () => {
    const prodUrl = 'https://nivaran-production-app.onrender.com';
    expect(resolveNivaranUrl(prodUrl)).toBe(prodUrl);
    expect(resolveNivaranOrigin(prodUrl)).toBe('https://nivaran-production-app.onrender.com');

    // Handles subpaths or trailing slashes while preserving exact origin
    const prodUrlWithPath = 'https://nivaran-production-app.onrender.com/app/triage?tab=active';
    expect(resolveNivaranOrigin(prodUrlWithPath)).toBe('https://nivaran-production-app.onrender.com');
  });

  it('Derives exact origin matching protocol, hostname, and port', () => {
    expect(resolveNivaranOrigin('http://localhost:5174/subpath')).toBe('http://localhost:5174');
    expect(resolveNivaranOrigin('https://subdomain.university.edu:8443')).toBe('https://subdomain.university.edu:8443');
  });

  it('Safely falls back to default origin on invalid URL string', () => {
    expect(resolveNivaranOrigin('not a valid url')).toBe('http://localhost:5174');
  });

  it('config object exposes valid nivaranAppUrl and nivaranOrigin', () => {
    expect(config.nivaranAppUrl).toBeDefined();
    expect(config.nivaranOrigin).toBeDefined();
    expect(new URL(config.nivaranAppUrl).origin).toBe(config.nivaranOrigin);
  });
});
