import { secureApiClient, ApiClientError } from './secureApiClient';

function makeJsonResponse(body: any, init: { status: number; headers?: Record<string, string> }) {
  const headers = new Headers({ 'content-type': 'application/json', ...(init.headers ?? {}) });
  return new Response(JSON.stringify(body), { status: init.status, headers });
}

function makeTextResponse(text: string, init: { status: number; headers?: Record<string, string> }) {
  const headers = new Headers({ 'content-type': 'text/plain', ...(init.headers ?? {}) });
  return new Response(text, { status: init.status, headers });
}

describe('secureApiClient strict mode', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
    secureApiClient.clearCache();
  });

  it('retourne ApiResponse success=true pour une réponse 200 JSON', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(makeJsonResponse({ ok: true }, { status: 200 }));

    const res = await secureApiClient.get<{ ok: boolean }>('/ping', { skipAuth: true, skipCache: true });

    expect(res.success).toBe(true);
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
  });

  it('throw ApiClientError sur 429 avec headers + details FastAPI', async () => {
    const body = { detail: { message: 'Rate limit dépassé', code: 'RATE_LIMITED' } };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeJsonResponse(body, { status: 429, headers: { 'retry-after': '60' } }))
      .mockResolvedValueOnce(makeJsonResponse(body, { status: 429, headers: { 'retry-after': '60' } }));

    await expect(
      secureApiClient.post('/auth/change-password', { a: 1 }, { skipAuth: true, skipCache: true })
    ).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 429,
      code: 'RATE_LIMITED',
    });

    try {
      await secureApiClient.post('/auth/change-password', { a: 1 }, { skipAuth: true, skipCache: true });
    } catch (e) {
      const err = e as ApiClientError;
      expect(err.status).toBe(429);
      expect(err.headers['retry-after']).toBe('60');
      expect((err.details as any)?.detail?.code).toBe('RATE_LIMITED');
      expect(err.code).toBe('RATE_LIMITED');
      expect(err.message).toContain('Rate limit');
    }
  });

  it('throw ApiClientError sur 400 text/plain', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTextResponse('Bad request', { status: 400 }))
      .mockResolvedValueOnce(makeTextResponse('Bad request', { status: 400 }));

    await expect(
      secureApiClient.get('/bad', { skipAuth: true, skipCache: true })
    ).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 400,
    });

    try {
      await secureApiClient.get('/bad', { skipAuth: true, skipCache: true });
    } catch (e) {
      const err = e as ApiClientError;
      expect(err.message).toBe('Bad request');
      expect(err.details).toBe('Bad request');
    }
  });
});
