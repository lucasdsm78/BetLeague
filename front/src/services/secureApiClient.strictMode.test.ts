import { secureApiClient, ApiClientError } from './secureApiClient';
import enhancedAuthService from './authService.enhanced';

function makeJsonResponse(body: any, init: { status: number; headers?: Record<string, string> }) {
  const headers = new Headers({ 'content-type': 'application/json', ...(init.headers ?? {}) });
  return new Response(JSON.stringify(body), { status: init.status, headers });
}

function makeTextResponse(text: string, init: { status: number; headers?: Record<string, string> }) {
  const headers = new Headers({ 'content-type': 'text/plain', ...(init.headers ?? {}) });
  return new Response(text, { status: init.status, headers });
}

function makeJwt(payload: Record<string, unknown>) {
  return [
    btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    btoa(JSON.stringify(payload)),
    'signature',
  ].join('.');
}

describe('secureApiClient strict mode', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = jest.fn();
    window.localStorage.clear();
  });

  afterEach(async () => {
    jest.resetAllMocks();
    secureApiClient.clearCache();
    await enhancedAuthService.logout({ server: false });
    window.localStorage.clear();
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

    const capturedError = await secureApiClient
      .post('/auth/change-password', { a: 1 }, { skipAuth: true, skipCache: true })
      .catch((error: unknown) => error);

    expect(capturedError).toBeInstanceOf(ApiClientError);
    const err = capturedError as ApiClientError;
    expect(err.status).toBe(429);
    expect(err.headers['retry-after']).toBe('60');
    expect((err.details as any)?.detail?.code).toBe('RATE_LIMITED');
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.message).toContain('Rate limit');
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

    const capturedError = await secureApiClient
      .get('/bad', { skipAuth: true, skipCache: true })
      .catch((error: unknown) => error);

    expect(capturedError).toBeInstanceOf(ApiClientError);
    const err = capturedError as ApiClientError;
    expect(err.message).toBe('Bad request');
    expect(err.details).toBe('Bad request');
  });

  it('envoie uniquement Authorization pour les requêtes authentifiées', async () => {
    const token = makeJwt({
      sub: 'front@example.com',
      username: 'front',
      pseudo: 'front',
      id: 'user-1',
      exp: Math.floor((Date.now() + 60_000) / 1000),
    });

    enhancedAuthService.applySessionTokens({
      token_auth: token,
      token_expiration: new Date(Date.now() + 60_000).toISOString(),
    }, {
      email: 'front@example.com',
      pseudo: 'front',
      username: 'front',
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce(makeJsonResponse({ ok: true }, { status: 200 }));

    await secureApiClient.get('/secure', { skipCache: true });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${token}`);
    expect(headers['X-Authentication']).toBeUndefined();
    expect(typeof headers['X-Request-Id']).toBe('string');
    expect(headers['X-Request-Id']).not.toHaveLength(0);
  });

  it('propage le X-Request-Id du backend dans ApiClientError', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeJsonResponse(
        { detail: { message: 'Internal error', code: 'INTERNAL_ERROR' } },
        { status: 500, headers: { 'x-request-id': 'api-req-500' } }
      )
    );

    await expect(
      secureApiClient.get('/boom', { skipAuth: true, skipCache: true })
    ).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 500,
      requestId: 'api-req-500',
    });
  });
});
