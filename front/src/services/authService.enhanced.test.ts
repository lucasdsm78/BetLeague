import enhancedAuthService from './authService.enhanced';
import { useAuthStore } from '../store/authStore';

function makeJsonResponse(body: any, init: { status: number; headers?: Record<string, string> }) {
  const headers = new Headers({ 'content-type': 'application/json', ...(init.headers ?? {}) });
  return new Response(JSON.stringify(body), { status: init.status, headers });
}

function makeJwt(payload: Record<string, unknown>) {
  return [
    btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    btoa(JSON.stringify(payload)),
    'signature',
  ].join('.');
}

describe('enhancedAuthService', () => {
  beforeEach(async () => {
    // @ts-ignore
    global.fetch = jest.fn();
    window.localStorage.clear();
    useAuthStore.getState().logout();
    (window as any).__AUTH_INITIALIZED__ = false;
    await enhancedAuthService.logout({ server: false });
  });

  afterEach(async () => {
    jest.resetAllMocks();
    useAuthStore.getState().logout();
    (window as any).__AUTH_INITIALIZED__ = false;
    await enhancedAuthService.logout({ server: false });
    window.localStorage.clear();
  });

  it('connecte l’utilisateur en mémoire seulement, sans persister dans localStorage', async () => {
    const token = makeJwt({
      sub: 'player@example.com',
      username: 'player',
      pseudo: 'player',
      id: 'user-42',
      exp: Math.floor((Date.now() + 60_000) / 1000),
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce(makeJsonResponse({
      token_auth: token,
      uuid: 'user-42',
      token_expiration: new Date(Date.now() + 60_000).toISOString(),
      two_factor_enabled: false,
      message: 'Connexion réussie.',
    }, { status: 200 }));

    const result = await enhancedAuthService.login({
      email: 'player@example.com',
      password: 'VeryStrong123!',
    });

    expect(result.user).toMatchObject({
      id: 'user-42',
      email: 'player@example.com',
      pseudo: 'player',
      username: 'player',
    });
    expect(result.token).toBe(token);
    expect(enhancedAuthService.getCurrentToken()).toBe(token);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(window.localStorage.length).toBe(0);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/auth/login');
    expect(init.credentials).toBe('include');
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('register retourne un message neutre sans ouvrir de session', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(makeJsonResponse({
      message: "Si l'inscription est possible, vous pouvez maintenant vous connecter.",
    }, { status: 202 }));

    const result = await enhancedAuthService.register({
      pseudo: 'newplayer',
      email: 'new@example.com',
      password: 'VeryStrong123!',
      confirmPassword: 'VeryStrong123!',
      acceptTerms: true,
    });

    expect(result.user).toMatchObject({
      email: 'new@example.com',
      pseudo: 'newplayer',
      username: 'newplayer',
    });
    expect(result.message).toContain('vous pouvez maintenant vous connecter');
    expect(enhancedAuthService.getCurrentToken()).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(window.localStorage.length).toBe(0);
  });

  it('restoreSession utilise le refresh cookie HttpOnly et restaure un access token mémoire', async () => {
    const token = makeJwt({
      sub: 'cookie@example.com',
      username: 'cookie-user',
      pseudo: 'cookie-user',
      id: 'user-cookie',
      exp: Math.floor((Date.now() + 60_000) / 1000),
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce(makeJsonResponse({
      token_auth: token,
      token_expiration: new Date(Date.now() + 60_000).toISOString(),
      message: 'Session renouvelée avec succès.',
    }, { status: 200 }));

    const restored = await enhancedAuthService.restoreSession();

    expect(restored).toMatchObject({
      token,
      user: {
        id: 'user-cookie',
        email: 'cookie@example.com',
        username: 'cookie-user',
        pseudo: 'cookie-user',
      },
    });
    expect(enhancedAuthService.getCurrentToken()).toBe(token);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/auth/refresh');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeUndefined();
    expect(window.localStorage.length).toBe(0);
  });

  it('logout vide la session mémoire et appelle la route serveur avec Authorization + cookie', async () => {
    const token = makeJwt({
      sub: 'logout@example.com',
      username: 'logout-user',
      pseudo: 'logout-user',
      id: 'user-logout',
      exp: Math.floor((Date.now() + 60_000) / 1000),
    });

    enhancedAuthService.applySessionTokens({
      token_auth: token,
      token_expiration: new Date(Date.now() + 60_000).toISOString(),
    }, {
      email: 'logout@example.com',
      pseudo: 'logout-user',
      username: 'logout-user',
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce(makeJsonResponse({
      message: 'Déconnexion réussie',
    }, { status: 200 }));

    await enhancedAuthService.logout();

    expect(enhancedAuthService.getCurrentToken()).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(window.localStorage.length).toBe(0);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/auth/logout');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.headers.Authorization).toBe(`Bearer ${token}`);
  });
});

