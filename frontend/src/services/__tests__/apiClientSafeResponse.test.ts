import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from '../apiClient';

describe('apiClient Safe Response Handling', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('1. Successfully parses valid JSON 200 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true, message: 'OK', data: { items: [1, 2, 3], total: 3 } }),
    });

    const res = await apiClient.get<{ items: number[]; total: number }>('/admin/sama/certificates');
    expect(res.success).toBe(true);
    expect(res.data?.items).toHaveLength(3);
    expect(res.data?.total).toBe(3);
  });

  it('2. Successfully handles valid empty JSON 200 result without error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true, message: 'Empty', data: { items: [], total: 0 } }),
    });

    const res = await apiClient.get<{ items: any[]; total: number }>('/admin/sama/certificates');
    expect(res.success).toBe(true);
    expect(res.data?.items).toEqual([]);
    expect(res.data?.total).toBe(0);
  });

  it('3. Gracefully handles unexpected HTML response without throwing SyntaxError', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: async () => '<!DOCTYPE html><html><head><title>503 Service Unavailable</title></head><body><h1>Service Unavailable</h1></body></html>',
    });

    await expect(apiClient.get('/admin/sama/certificates')).rejects.toThrow(ApiError);

    try {
      await apiClient.get('/admin/sama/certificates');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(503);
      expect(err.message).toContain('Service Unavailable (HTTP 503)');
      // Must NOT throw SyntaxError or mention Unexpected token '<'
      expect(err.message).not.toContain('Unexpected token');
      expect(err.message).not.toContain('<!DOCTYPE');
      // Axios-compatible response structure preserved
      expect(err.response?.status).toBe(503);
      expect(err.response?.data?.message).toBeDefined();
    }
  });

  it('4. Gracefully handles SPA rewrite HTML fallback returning 200 OK', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '<!DOCTYPE html><html><head><title>VYASA React App</title></head><body><div id="root"></div></body></html>',
    });

    try {
      await apiClient.get('/admin/sama/unknown-route');
      expect.fail('Should have thrown an ApiError for HTML response');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.errorCode).toBe('UNEXPECTED_HTML');
      expect(err.message).toContain('Unexpected HTML response received from server');
    }
  });

  it('5. Properly handles 401 Unauthorized JSON with meaningful message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: false, message: 'User account is deactivated.', error: { code: 'HTTP_401' } }),
    });

    try {
      await apiClient.get('/admin/sama/certificates');
      expect.fail('Should have thrown ApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe('User account is deactivated.');
      expect(err.response?.data?.message).toBe('User account is deactivated.');
    }
  });

  it('6. Properly handles 403 Forbidden JSON with meaningful message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: false, message: 'Permission denied: sama:certificate:revoke required', error: { code: 'HTTP_403' } }),
    });

    try {
      await apiClient.post('/admin/sama/certificates/123/revoke');
      expect.fail('Should have thrown ApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(403);
      expect(err.message).toContain('Permission denied');
    }
  });

  it('7. Properly handles 404 Not Found JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: false, message: 'Certificate not found.', error: { code: 'HTTP_404' } }),
    });

    try {
      await apiClient.get('/admin/sama/certificates/00000000-0000-0000-0000-000000000000');
      expect.fail('Should have thrown ApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe('Certificate not found.');
    }
  });

  it('8. Properly handles 500 Internal Server Error JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: false, message: 'Internal server error', error: { code: 'INTERNAL_SERVER_ERROR' } }),
    });

    try {
      await apiClient.get('/admin/sama/certificates');
      expect.fail('Should have thrown ApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe('Internal server error');
    }
  });

  it('9. Properly handles Network failure (fetch rejection)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    try {
      await apiClient.get('/admin/sama/certificates');
      expect.fail('Should have thrown ApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(0);
      expect(err.errorCode).toBe('NETWORK_ERROR');
      expect(err.message).toContain('Unable to connect to VYASA backend service');
    }
  });
});
