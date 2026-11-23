import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
import { tokenStore } from './tokenStore';

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as Response;
}

function success<T>(data: T) {
  return {
    success: true,
    data,
    correlationId: 'corr-123',
    timestamp: '2026-01-01T00:00:00Z',
  };
}

afterEach(() => {
  tokenStore.clear();
  tokenStore.registerRefreshHandler(null);
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('unwraps ApiResponse and sends the bearer token', async () => {
    tokenStore.setTokens('access-token');
    const fetchMock = vi.fn().mockResolvedValue(response(200, success({ id: 7 })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get<{ id: number }>('/inventory/7')).resolves.toEqual({ id: 7 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/v1/inventory/7');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-token');
  });

  it('throws a typed ApiError with code, message, correlationId and details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(403, {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You cannot release this unit.',
        details: { unitId: '7' },
        correlationId: 'corr-error',
      },
      timestamp: '2026-01-01T00:00:00Z',
    })));

    await expect(api.post('/inventory/7/release')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'FORBIDDEN',
      message: 'You cannot release this unit.',
      correlationId: 'corr-error',
      status: 403,
      details: { unitId: '7' },
    });
  });

  it('adds an explicit or generated Idempotency-Key header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(201, success({ id: 1 })));
    vi.stubGlobal('fetch', fetchMock);

    await api.post('/reservations', {}, { auth: false, idempotencyKey: 'my-key' });
    await api.post('/reservations', {}, { auth: false, idempotencyKey: true });

    const first = new Headers(fetchMock.mock.calls[0][1].headers).get('Idempotency-Key');
    const second = new Headers(fetchMock.mock.calls[1][1].headers).get('Idempotency-Key');
    expect(first).toBe('my-key');
    expect(second).toMatch(/^idem-|^[0-9a-f-]{36}$/);
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    tokenStore.setTokens('expired-token', 'refresh-token');
    const refreshMock = vi.fn(async () => {
      tokenStore.setTokens('fresh-token');
      return true;
    });
    tokenStore.registerRefreshHandler(refreshMock);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401, {
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Expired', correlationId: 'corr-401' },
        timestamp: '2026-01-01T00:00:00Z',
      }))
      .mockResolvedValueOnce(response(200, success({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/auth/me')).resolves.toEqual({ ok: true });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer fresh-token');
  });

  it('does not refresh public auth requests and clears the session on failed refresh', async () => {
    tokenStore.setTokens('expired-token', 'refresh-token');
    const refreshMock = vi.fn(async () => false);
    tokenStore.registerRefreshHandler(refreshMock);
    const expiredListener = vi.fn();
    const unsubscribe = tokenStore.onSessionExpired(expiredListener);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401, {
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Expired', correlationId: 'corr-401' },
      timestamp: '2026-01-01T00:00:00Z',
    })));

    await expect(api.post('/auth/login', {}, { auth: false })).rejects.toBeInstanceOf(ApiError);
    expect(refreshMock).not.toHaveBeenCalled();

    await expect(api.get('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(expiredListener).toHaveBeenCalledTimes(1);
    expect(tokenStore.getAccessToken()).toBeNull();
    unsubscribe();
  });

  it('rejects malformed success payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, { success: true })));
    await expect(api.get('/analytics/overview')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INVALID_RESPONSE',
    });
  });
});
