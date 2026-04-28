/**
 * Enhanced Authentication Service - memory-only access token + refresh cookie HttpOnly
 */

import { useAuthStore } from '../store/authStore';
import type { User, LoginForm, RegisterForm } from '../types';

export interface TokenPair { accessToken: string; expiresAt: number; }
export interface RefreshResponse { token_auth: string; token_expiration: string; message: string; }
export interface RegisterResponse { message?: string; }
export interface AuthServiceConfig { baseURL: string; tokenRefreshBuffer: number; maxRefreshRetries: number; refreshCooldown: number; requestTimeout: number; }

export class AuthError extends Error {
  constructor(public message: string, public readonly status: number = 0, public readonly code?: string, public readonly retryable: boolean = false) { super(message); this.name='AuthError'; }
  isNetworkError(){return this.status===0;} isUnauthorized(){return this.status===401;} isForbidden(){return this.status===403;} isTooManyRequests(){return this.status===429;} isConflict(){return this.status===409;} isServerError(){return this.status>=500;} getDisplayMessage(){return this.message;}
}

class EnhancedAuthService {
  private config: AuthServiceConfig;
  private refreshPromise: Promise<TokenPair> | null = null;
  private lastRefreshAttempt = 0;
  private refreshRetryCount = 0;
  private accessToken: string | null = null;
  private accessTokenExpiresAt: number | null = null;

  constructor(config: Partial<AuthServiceConfig> = {}) {
    this.config = {
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8001/api',
      tokenRefreshBuffer: 5 * 60 * 1000,
      maxRefreshRetries: 3,
      refreshCooldown: 30 * 1000,
      requestTimeout: 10000,
      ...config,
    };
  }

  private isNonRefreshAuthEndpoint(endpoint: string): boolean {
    return [
      '/auth/login',
      '/auth/register',
      '/auth/logout',
      '/auth/logout-all',
      '/auth/logout-others',
      '/auth/refresh',
    ].some((path) => endpoint.includes(path));
  }

  private computeExpiry(tokenAuth: string, tokenExpiration?: string): number {
    if (tokenExpiration) {
      const parsed = new Date(tokenExpiration).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
    try {
      const tokenPayload = JSON.parse(atob(tokenAuth.split('.')[1]));
      if (tokenPayload.exp) return Number(tokenPayload.exp) * 1000;
    } catch {}
    return Date.now() + 24 * 60 * 60 * 1000;
  }

  private buildUserFromToken(token: string): User {
    const tokenPayload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: tokenPayload.id || tokenPayload.user_id,
      email: tokenPayload.sub || tokenPayload.email,
      username: tokenPayload.username || tokenPayload.pseudo,
      pseudo: tokenPayload.pseudo || tokenPayload.username || (tokenPayload.sub || '').split('@')[0],
    };
  }

  private setTokenPair(tp: TokenPair): void {
    this.accessToken = tp.accessToken;
    this.accessTokenExpiresAt = tp.expiresAt;
  }

  private getStoredTokenPair(): TokenPair | null {
    if (!this.accessToken || !this.accessTokenExpiresAt) return null;
    return { accessToken: this.accessToken, expiresAt: this.accessTokenExpiresAt };
  }

  applySessionTokens(response: Partial<RefreshResponse>, userUpdates: Partial<User> = {}): boolean {
    const tokenAuth = (response.token_auth || '').trim();
    if (!tokenAuth) return false;

    const tokenPair: TokenPair = {
      accessToken: tokenAuth,
      expiresAt: this.computeExpiry(tokenAuth, response.token_expiration),
    };

    this.setTokenPair(tokenPair);
    const authStore = useAuthStore.getState();
    const currentUser = authStore.user;
    const baseUser = currentUser ?? this.buildUserFromToken(tokenPair.accessToken);
    authStore.login({ ...baseUser, ...userUpdates }, tokenPair.accessToken);
    return true;
  }

  private async makeRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;
    const isAuthEndpoint = this.isNonRefreshAuthEndpoint(endpoint);

    if (!isAuthEndpoint) {
      await this.ensureValidToken();
    }

    const token = this.getCurrentAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeout);
    const cfg = { ...options, headers, signal: controller.signal, credentials: 'include' as RequestCredentials };

    try {
      const resp = await fetch(url, cfg);
      clearTimeout(timeout);

      if (resp.status === 401 && !isAuthEndpoint) {
        const refreshed = await this.refreshTokenIfNeeded(true);
        if (refreshed) {
          const newToken = this.getCurrentAccessToken();
          const retryHeaders = { ...headers, ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}) };
          const retryResp = await fetch(url, { ...cfg, headers: retryHeaders });
          return this.handleResponse<T>(retryResp, endpoint);
        }
        throw new AuthError('Authentication required', 401, 'TOKEN_EXPIRED');
      }

      return this.handleResponse<T>(resp, endpoint);
    } catch (err: any) {
      clearTimeout(timeout);
      if (err?.name === 'AbortError') throw new AuthError('Délai dépassé, serveur injoignable', 0, 'NETWORK_TIMEOUT', true);
      if (err instanceof AuthError) throw err;
      throw new AuthError('Network error', 0, 'NETWORK_ERROR', true);
    }
  }

  private async handleResponse<T>(response: Response, endpoint?: string): Promise<T> {
    if (!response.ok) {
      let msg: any = 'Request failed';
      let code = 'REQUEST_FAILED';

      try {
        const raw: any = await response.json();
        const detail = raw?.detail ?? raw;
        if (typeof detail === 'object' && detail) {
          msg = detail.message || detail.detail || raw?.message || msg;
          code = detail.code || raw?.code || code;
          if (!code && detail.two_factor_required) code = 'TWO_FACTOR_REQUIRED';
        } else {
          msg = detail?.message || detail || msg;
          code = raw?.code || code;
        }
      } catch {
        msg = response.statusText || msg;
      }

      if (response.status === 401) {
        const isLoginEndpoint = typeof endpoint === 'string' && /\/auth\/login$/.test(endpoint);
        if (isLoginEndpoint) {
          code = code && code !== 'REQUEST_FAILED' ? code : 'INVALID_CREDENTIALS';
          msg = typeof msg === 'string' && msg.trim().length > 0 ? msg : 'Email ou mot de passe incorrect.';
        }
      }

      const headerCode = response.headers.get('X-Error-Code');
      if (headerCode && (!code || code === 'REQUEST_FAILED')) code = headerCode;
      if (Array.isArray(msg)) {
        msg = msg.map((e: any) => {
          const loc = Array.isArray(e?.loc) ? e.loc.filter((x: any) => x !== 'body').join('.') : '';
          return `${loc || 'champ'}: ${e?.msg || e?.type || 'Erreur'}`;
        }).join(' | ');
      } else if (typeof msg === 'object') {
        msg = JSON.stringify(msg);
      }

      if (response.status === 422 && (!code || code === 'REQUEST_FAILED')) {
        code = 'UNPROCESSABLE_ENTITY';
        if (!msg || msg === 'Request failed') msg = 'Données invalides (422). Vérifiez les champs.';
      }

      const lower = String(msg).toLowerCase();
      if (response.status === 400 && (!code || code === 'REQUEST_FAILED')) {
        if (lower.includes('2fa') && lower.includes('required')) code = 'TWO_FACTOR_REQUIRED';
        else if (lower.includes('invalid') && lower.includes('2fa')) code = 'INVALID_2FA_CODE';
      }

      throw new AuthError(String(msg), response.status, code, response.status >= 500 || response.status === 429);
    }

    try {
      return await response.json();
    } catch {
      return {} as T;
    }
  }

  private getCurrentAccessToken(): string | null {
    return this.accessToken;
  }

  private isTokenExpired(expiresAt: number): boolean {
    return Date.now() >= (expiresAt - this.config.tokenRefreshBuffer);
  }

  private shouldRefreshToken(): boolean {
    const p = this.getStoredTokenPair();
    if (!p) return false;
    return this.isTokenExpired(p.expiresAt);
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.getCurrentAccessToken() || this.shouldRefreshToken()) {
      await this.refreshTokenIfNeeded(true);
    }
  }

  private async refreshTokenIfNeeded(force = false): Promise<boolean> {
    const currentPair = this.getStoredTokenPair();
    if (!force && currentPair && !this.shouldRefreshToken()) return true;
    if (this.refreshPromise) {
      try { await this.refreshPromise; return true; } catch { return false; }
    }

    const now = Date.now();
    if (now - this.lastRefreshAttempt < this.config.refreshCooldown) {
      return Boolean(this.getCurrentAccessToken() && !this.shouldRefreshToken());
    }
    if (this.refreshRetryCount >= this.config.maxRefreshRetries) {
      await this.logout({ server: false });
      return false;
    }

    this.lastRefreshAttempt = now;
    this.refreshRetryCount += 1;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const newPair = await this.refreshPromise;
      this.setTokenPair(newPair);
      const authStore = useAuthStore.getState();
      if (authStore.user) {
        authStore.login(authStore.user, newPair.accessToken);
      }
      this.refreshRetryCount = 0;
      return true;
    } catch (err) {
      if (err instanceof AuthError && err.isUnauthorized()) {
        await this.logout({ server: false });
      }
      return false;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<TokenPair> {
    const resp = await fetch(`${this.config.baseURL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      const detail = errData?.detail;
      const message = typeof detail === 'string' ? detail : detail?.message || 'Token refresh failed';
      throw new AuthError(message, resp.status, detail?.code || 'REFRESH_FAILED');
    }

    const data: RefreshResponse = await resp.json();
    return {
      accessToken: data.token_auth,
      expiresAt: this.computeExpiry(data.token_auth, data.token_expiration),
    };
  }

  async login(credentials: LoginForm): Promise<{ user: User; token: string }> {
    try {
      const payload: any = { email: credentials.email, password: credentials.password };
      if (credentials.code && credentials.code.toString().trim().length > 0) payload.code = credentials.code.toString().trim();

      const response = await this.makeRequest<any>('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
      const tokenAuth = response.token_auth || response.token || response.access_token || response.accessToken;
      const userId = response.uuid || response.user_id || response.id || response.id_user || response.userId;

      if (!tokenAuth || !userId) {
        if (response.two_factor_required || response.code === 'TWO_FACTOR_REQUIRED') {
          throw new AuthError('Deuxième facteur requis', 400, 'TWO_FACTOR_REQUIRED');
        }
        throw new AuthError('Réponse de connexion invalide (token manquant)', 500, 'INVALID_RESPONSE');
      }

      const user: User = {
        id: userId,
        email: credentials.email,
        pseudo: credentials.email.split('@')[0],
        username: credentials.email.split('@')[0],
        twoFactorEnabled: !!response.two_factor_enabled,
      };

      this.setTokenPair({ accessToken: tokenAuth, expiresAt: this.computeExpiry(tokenAuth, response.token_expiration) });
      useAuthStore.getState().login(user, tokenAuth);
      return { user, token: tokenAuth };
    } catch (error) {
      if (error instanceof AuthError) {
        const msg = (error.message || '').toLowerCase();
        if (error.status === 400) {
          if (msg.includes('code required')) throw new AuthError('Deuxième facteur requis', 400, 'TWO_FACTOR_REQUIRED');
          if (msg.includes('invalid 2fa code') || msg.includes('invalid 2fa')) throw new AuthError('Code 2FA invalide', 400, 'INVALID_2FA_CODE');
        }
        const isTwoFa = error.code === 'TWO_FACTOR_REQUIRED' || (error.status === 401 && (msg.includes('2fa') || (msg.includes('two') && msg.includes('factor'))));
        if (isTwoFa) throw new AuthError('Deuxième facteur requis', error.status || 400, 'TWO_FACTOR_REQUIRED');
        if (error.status === 422) throw new AuthError(error.message || 'Données invalides', 422, 'UNPROCESSABLE_ENTITY');
      }
      if (!(error instanceof AuthError)) throw new AuthError('Login failed');
      if (error.isUnauthorized() && (!error.code || error.code === 'REQUEST_FAILED')) {
        throw new AuthError('Email ou mot de passe incorrect.', 401, 'INVALID_CREDENTIALS');
      }
      throw error;
    }
  }

  async register(credentials: RegisterForm): Promise<{ user: User; message?: string }> {
    const response = await this.makeRequest<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ pseudo: credentials.pseudo, email: credentials.email, password: credentials.password }),
    });

    return {
      user: {
        email: credentials.email,
        pseudo: credentials.pseudo,
        username: credentials.pseudo,
      },
      message: response?.message,
    };
  }

  async validateToken(): Promise<{ user: User }> {
    const token = this.getCurrentAccessToken();
    if (!token) throw new AuthError('No token available', 401, 'NO_TOKEN');
    try {
      return { user: this.buildUserFromToken(token) };
    } catch {
      throw new AuthError('Invalid token format', 401, 'INVALID_TOKEN');
    }
  }

  async restoreSession(): Promise<{ user: User; token: string } | null> {
    const token = this.getCurrentAccessToken();
    if (token && !this.shouldRefreshToken()) {
      return { user: this.buildUserFromToken(token), token };
    }
    const refreshed = await this.refreshTokenIfNeeded(true);
    if (!refreshed) return null;
    const newToken = this.getCurrentAccessToken();
    if (!newToken) return null;
    return { user: this.buildUserFromToken(newToken), token: newToken };
  }

  private clearSession(): void {
    this.accessToken = null;
    this.accessTokenExpiresAt = null;
    this.refreshPromise = null;
    this.refreshRetryCount = 0;
    (window as any).__AUTH_INITIALIZED__ = false;
    useAuthStore.getState().logout();
  }

  async logout(options: { server?: boolean } = {}): Promise<void> {
    const { server = true } = options;
    try {
      if (server) {
        await this.makeRequest('/auth/logout', { method: 'POST' });
      }
    } catch {
    } finally {
      this.clearSession();
    }
  }

  isAuthenticated(): boolean {
    const p = this.getStoredTokenPair();
    if (!p) return false;
    return !this.isTokenExpired(p.expiresAt);
  }

  getCurrentToken(): string | null { return this.getCurrentAccessToken(); }
  getTokenExpiryTime(): number | null { return this.accessTokenExpiresAt; }
  getTimeUntilExpiry(): number { const exp = this.getTokenExpiryTime(); if (!exp) return 0; return Math.max(0, exp - Date.now()); }
  async forceRefresh(): Promise<boolean> { return this.refreshTokenIfNeeded(true); }
}

export const enhancedAuthService = new EnhancedAuthService();
export default enhancedAuthService;
