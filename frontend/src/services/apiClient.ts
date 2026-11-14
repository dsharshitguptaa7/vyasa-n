import { config } from '../config';
import { ApiResponse } from '../types/api';
import { authService } from './authService';

export class ApiError extends Error {
  public statusCode: number;
  public errorCode?: string;
  public details?: unknown;
  public response?: {
    status: number;
    data?: {
      message?: string;
      detail?: string;
      error?: { code?: string; details?: unknown };
      [key: string]: unknown;
    };
  };

  constructor(
    message: string,
    statusCode: number,
    errorCode?: string,
    details?: unknown,
    response?: {
      status: number;
      data?: {
        message?: string;
        detail?: string;
        error?: { code?: string; details?: unknown };
        [key: string]: unknown;
      };
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.response = response || {
      status: statusCode,
      data: {
        message,
        detail: message,
        error: errorCode ? { code: errorCode, details } : undefined,
      },
    };
  }
}

/**
 * Extracts a human-friendly error message from an HTTP response code
 * when a non-JSON or HTML payload is received (e.g. from reverse proxy or SPA fallback).
 */
function getFriendlyStatusMessage(status: number, isHtml: boolean): string {
  switch (status) {
    case 401:
      return 'Authentication required. Your session may have expired. Please sign in again.';
    case 403:
      return 'Access denied. You do not have the required permissions to perform this action.';
    case 404:
      return isHtml
        ? 'API endpoint not found (HTTP 404). The requested resource does not exist or reverse proxy routing is misconfigured.'
        : 'The requested API endpoint was not found.';
    case 502:
      return 'Bad Gateway (HTTP 502). The backend service is currently unreachable or starting up.';
    case 503:
      return 'Service Unavailable (HTTP 503). The database or backend service is undergoing maintenance or pending migrations.';
    case 504:
      return 'Gateway Timeout (HTTP 504). The backend request timed out.';
    default:
      if (status >= 500) {
        return `Backend Server Error (HTTP ${status}). Please try again later.`;
      }
      if (isHtml) {
        return `Unexpected HTML response received from server (HTTP ${status}) where JSON API data was expected.`;
      }
      return `Request failed with status ${status}`;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = `${config.apiBaseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const token = authService.getToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      credentials: options.credentials || 'include',
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.toLowerCase().includes('application/json');

    // Handle non-JSON responses (HTML error pages, plain text, SPA fallback)
    if (!isJson) {
      const rawText = await response.text();
      const isHtml = /<html|<head|<body|<!doctype/i.test(rawText);

      const friendlyMessage = getFriendlyStatusMessage(response.status, isHtml);
      const errorCode = response.status === 401 ? 'UNAUTHORIZED'
        : response.status === 403 ? 'FORBIDDEN'
        : response.status === 404 ? 'NOT_FOUND'
        : response.status === 503 ? 'SERVICE_UNAVAILABLE'
        : response.status >= 500 ? 'INTERNAL_SERVER_ERROR'
        : isHtml ? 'UNEXPECTED_HTML'
        : 'INVALID_RESPONSE';

      throw new ApiError(
        friendlyMessage,
        response.status,
        errorCode,
        { contentType, preview: rawText.slice(0, 300) },
        {
          status: response.status,
          data: {
            message: friendlyMessage,
            detail: friendlyMessage,
            error: { code: errorCode, details: rawText.slice(0, 300) },
          },
        }
      );
    }

    // Safely parse JSON response
    let data: any;
    try {
      data = await response.json();
    } catch (parseErr) {
      throw new ApiError(
        `Failed to parse JSON response from server (HTTP ${response.status})`,
        response.status,
        'JSON_PARSE_ERROR',
        parseErr
      );
    }

    // Check HTTP status or application-level failure
    if (!response.ok || (data && data.success === false)) {
      const message =
        data?.message ||
        data?.detail ||
        (typeof data?.error === 'string' ? data.error : data?.error?.message) ||
        getFriendlyStatusMessage(response.status, false);

      const errorCode =
        data?.error?.code ||
        (response.status === 401 ? 'UNAUTHORIZED' : response.status === 403 ? 'FORBIDDEN' : `HTTP_${response.status}`);

      throw new ApiError(
        message,
        response.status,
        errorCode,
        data?.error?.details || data?.detail,
        {
          status: response.status,
          data: {
            message,
            detail: typeof data?.detail === 'string' ? data.detail : message,
            error: data?.error,
            ...data,
          },
        }
      );
    }

    return data as ApiResponse<T>;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Unknown network error';
    const isNetwork = message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('Load failed');
    const userMessage = isNetwork
      ? 'Unable to connect to VYASA backend service. Please verify network connectivity.'
      : message;

    throw new ApiError(
      userMessage,
      0,
      'NETWORK_ERROR',
      err,
      {
        status: 0,
        data: {
          message: userMessage,
          detail: userMessage,
          error: { code: 'NETWORK_ERROR' },
        },
      }
    );
  }
}

export const apiClient = {
  get: <T>(endpoint: string, headers?: HeadersInit) =>
    request<T>(endpoint, { method: 'GET', headers }),
  post: <T>(endpoint: string, body?: unknown, headers?: HeadersInit) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),
  patch: <T>(endpoint: string, body?: unknown, headers?: HeadersInit) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),
  put: <T>(endpoint: string, body?: unknown, headers?: HeadersInit) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),
  postFormData: <T>(endpoint: string, formData: FormData, headers?: HeadersInit) =>
    request<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers,
    }),
  delete: <T>(endpoint: string, headers?: HeadersInit) =>
    request<T>(endpoint, { method: 'DELETE', headers }),
};
