import type { ApiErrorBody, ApiResponse, QueryParams, QueryValue } from '@/types/api';
import { tokenStore } from './tokenStore';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');
const API_VERSION = '/v1';

export class ApiError extends Error {
  readonly code: string;
  readonly correlationId: string;
  readonly status: number;
  readonly details?: Record<string, string>;

  constructor(input: {
    message: string;
    code: string;
    correlationId: string;
    status: number;
    details?: Record<string, string>;
  }) {
    super(input.message);
    this.name = 'ApiError';
    this.code = input.code;
    this.correlationId = input.correlationId;
    this.status = input.status;
    this.details = input.details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface ApiRequestOptions {
  /** JSON-serialisable request body. */
  body?: unknown;
  /** Send the bearer token. Defaults to true. Set false for /auth/login, /auth/register, /auth/refresh. */
  auth?: boolean;
  /** Sends an Idempotency-Key header. `true` generates a fresh UUID for this request. */
  idempotencyKey?: string | true;
  /** Overrides the active X-Organization-Id for one request; `null` explicitly removes it. */
  organizationId?: number | null;
  query?: QueryParams;
  signal?: AbortSignal;
  /** Internal: prevents a second refresh attempt on the retried request. */
  skipAuthRefresh?: boolean;
}

function appendQuery(path: string, query?: QueryParams): string {
  if (!query) return path;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((entry: QueryValue) => {
      if (entry !== null && entry !== undefined && entry !== '') {
        params.append(key, String(entry));
      }
    });
  });
  const search = params.toString();
  return search ? `${path}${path.includes('?') ? '&' : '?'}${search}` : path;
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ApiErrorBody>;
  return candidate.success === false && !!candidate.error && typeof candidate.error.message === 'string';
}

function errorFromBody(body: unknown, status: number): ApiError {
  if (isErrorBody(body)) {
    return new ApiError({
      message: body.error.message,
      code: body.error.code,
      correlationId: body.error.correlationId,
      status,
      details: body.error.details,
    });
  }
  return new ApiError({
    message: status === 0 ? 'Unable to reach the server.' : `Request failed (${status}).`,
    code: status === 0 ? 'NETWORK_ERROR' : 'HTTP_ERROR',
    correlationId: 'unknown',
    status,
  });
}

async function request<T>(method: string, path: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    body,
    auth = true,
    idempotencyKey,
    organizationId,
    query,
    signal,
    skipAuthRefresh = false,
  } = options;

  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  // The active organization is part of every request's identity, including public
  // auth calls (registration codes are organization-scoped). Read it per request so
  // a switch takes effect immediately, even for requests already in flight.
  const requestOrganizationId =
    organizationId !== undefined ? organizationId : tokenStore.getOrganizationId();
  if (requestOrganizationId !== null) {
    headers.set('X-Organization-Id', String(requestOrganizationId));
  }
  if (auth) {
    const token = tokenStore.getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  if (idempotencyKey) {
    headers.set('Idempotency-Key', idempotencyKey === true ? createIdempotencyKey() : idempotencyKey);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${API_VERSION}${appendQuery(path, query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw errorFromBody(null, 0);
  }

  if (response.status === 401 && auth && !skipAuthRefresh && tokenStore.getRefreshToken()) {
    const refreshed = await tokenStore.refresh().catch(() => false);
    if (refreshed) {
      return request<T>(method, path, { ...options, skipAuthRefresh: true });
    }
    tokenStore.expireSession();
  }

  const payload: unknown = await readJson(response).catch(() => null);

  if (!response.ok || isErrorBody(payload)) {
    throw errorFromBody(payload, response.status);
  }

  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiError({
      message: 'The server returned an unexpected response.',
      code: 'INVALID_RESPONSE',
      correlationId:
        payload && typeof payload === 'object' && 'correlationId' in payload
          ? String((payload as ApiResponse<unknown>).correlationId)
          : 'unknown',
      status: response.status,
    });
  }

  return (payload as ApiResponse<T>).data;
}

export const api = {
  get: <T>(path: string, options?: Omit<ApiRequestOptions, 'body'>) =>
    request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>('POST', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>('PATCH', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>('PUT', path, { ...options, body }),
  delete: <T>(path: string, options?: ApiRequestOptions) => request<T>('DELETE', path, options),
  createIdempotencyKey,
  request,
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const suffix = error.correlationId !== 'unknown' ? ` (ref: ${error.correlationId.slice(0, 8)})` : '';
    return `${error.message}${suffix}`;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
