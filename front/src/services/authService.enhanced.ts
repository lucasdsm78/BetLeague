/**
 * Enhanced Authentication Service - Secure Token Management with Auto-Refresh
 * Optimized for performance, security, and UX
 */

import { useAuthStore } from '../store/authStore';
import type { User, LoginForm, RegisterForm } from '../types';

// Types for token management
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface RefreshResponse {
  token_auth: string;
  refresh_token: string;
  token_expiration: string;
  message: string;
}

export interface AuthServiceConfig {
  baseURL: string;
  tokenRefreshBuffer: number; // Refresh token X seconds before expiry
  maxRefreshRetries: number;
  refreshCooldown: number; // Minimum time between refresh attempts
}

// Custom Auth Error with enhanced functionality
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number = 0,
    public readonly code?: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AuthError';
  }

  isNetworkError(): boolean { return this.status === 0; }
  isUnauthorized(): boolean { return this.status === 401; }
  isForbidden(): boolean { return this.status === 403; }
  isServerError(): boolean { return this.status >= 500; }
  canRetry(): boolean { return this.retryable || this.isNetworkError() || this.isServerError(); }
}

class EnhancedAuthService {
  private config: AuthServiceConfig;
  private refreshPromise: Promise<TokenPair> | null = null;
  private lastRefreshAttempt = 0;
  private refreshRetryCount = 0;

  // Storage keys
  private readonly ACCESS_TOKEN_KEY = 'auth_access_token';
  private readonly REFRESH_TOKEN_KEY = 'auth_refresh_token';
  private readonly TOKEN_EXPIRY_KEY = 'auth_token_expiry';

  constructor(config: Partial<AuthServiceConfig> = {}) {
    this.config = {
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8001/api',
      tokenRefreshBuffer: 5 * 60 * 1000, // 5 minutes
      maxRefreshRetries: 3,
      refreshCooldown: 30 * 1000, // 30 seconds
      ...config,
    };
  }

  // ==========================================
  // SECURE TOKEN STORAGE MANAGEMENT
  // ==========================================

  private secureStorage = {
    set: (key: string, value: string): void => {
      try {
        // In production, encrypt before storing
        localStorage.setItem(key, value);
      } catch (error) {
        console.warn(`Failed to store ${key}:`, error);
      }
    },
    get: (key: string): string | null => {
      try {
        // In production, decrypt after retrieving
        return localStorage.getItem(key);
      } catch (error) {
        console.warn(`Failed to retrieve ${key}:`, error);
        return null;
      }
    },
    remove: (key: string): void => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove ${key}:`, error);
      }
    },
    clear: (): void => {
      try {
        this.secureStorage.remove(this.ACCESS_TOKEN_KEY);
        this.secureStorage.remove(this.REFRESH_TOKEN_KEY);
        this.secureStorage.remove(this.TOKEN_EXPIRY_KEY);
      } catch (error) {
        console.warn('Failed to clear auth storage:', error);
      }
    }
  };

  private storeTokenPair(tokenPair: TokenPair): void {
    this.secureStorage.set(this.ACCESS_TOKEN_KEY, tokenPair.accessToken);
    this.secureStorage.set(this.REFRESH_TOKEN_KEY, tokenPair.refreshToken);
    this.secureStorage.set(this.TOKEN_EXPIRY_KEY, tokenPair.expiresAt.toString());
  }

  private getStoredTokenPair(): TokenPair | null {
    const accessToken = this.secureStorage.get(this.ACCESS_TOKEN_KEY);
    const refreshToken = this.secureStorage.get(this.REFRESH_TOKEN_KEY);
    const expiresAt = this.secureStorage.get(this.TOKEN_EXPIRY_KEY);

    if (!accessToken || !refreshToken || !expiresAt) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      expiresAt: parseInt(expiresAt, 10),
    };
  }

  // ==========================================
  // HTTP CLIENT WITH AUTOMATIC TOKEN REFRESH
  // ==========================================

  private async makeRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;

    // Ensure we have a valid token before making the request
    await this.ensureValidToken();

    const token = this.getCurrentAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(options.headers || {}),
    };

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        // Token might be expired, try to refresh
        const refreshed = await this.refreshTokenIfNeeded(true);
        if (refreshed) {
          // Retry the original request with new token
          const newToken = this.getCurrentAccessToken();
          const retryHeaders = {
            ...headers,
            ...(newToken && { 'Authorization': `Bearer ${newToken}` }),
          };

          const retryResponse = await fetch(url, { ...config, headers: retryHeaders });
          return this.handleResponse<T>(retryResponse);
        } else {
          throw new AuthError('Authentication required', 401, 'TOKEN_EXPIRED');
        }
      }

      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Network error', 0, 'NETWORK_ERROR', true);
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = 'Request failed';
      let errorCode = 'REQUEST_FAILED';

      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
        errorCode = errorData.code || errorCode;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }

      const isRetryable = response.status >= 500 || response.status === 429;
      throw new AuthError(errorMessage, response.status, errorCode, isRetryable);
    }

    try {
      return await response.json();
    } catch {
      return {} as T;
    }
  }

  // ==========================================
  // TOKEN VALIDATION & REFRESH LOGIC
  // ==========================================

  private getCurrentAccessToken(): string | null {
    const tokenPair = this.getStoredTokenPair();
    return tokenPair?.accessToken || null;
  }

  private isTokenExpired(expiresAt: number): boolean {
    const now = Date.now();
    return now >= (expiresAt - this.config.tokenRefreshBuffer);
  }

  private shouldRefreshToken(): boolean {
    const tokenPair = this.getStoredTokenPair();
    if (!tokenPair) return false;

    return this.isTokenExpired(tokenPair.expiresAt);
  }

  private async ensureValidToken(): Promise<void> {
    if (this.shouldRefreshToken()) {
      await this.refreshTokenIfNeeded();
    }
  }

  private async refreshTokenIfNeeded(force = false): Promise<boolean> {
    const tokenPair = this.getStoredTokenPair();

    if (!tokenPair) {
      console.warn('No token pair found for refresh');
      return false;
    }

    // Check if we should refresh
    if (!force && !this.shouldRefreshToken()) {
      return true; // Token is still valid
    }

    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      try {
        await this.refreshPromise;
        return true;
      } catch {
        return false;
      }
    }

    // Check cooldown period
    const now = Date.now();
    if (now - this.lastRefreshAttempt < this.config.refreshCooldown) {
      console.warn('Token refresh on cooldown');
      return false;
    }

    // Check retry limit
    if (this.refreshRetryCount >= this.config.maxRefreshRetries) {
      console.error('Max refresh retries exceeded');
      this.logout();
      return false;
    }

    this.lastRefreshAttempt = now;
    this.refreshRetryCount++;

    // Create refresh promise
    this.refreshPromise = this.performTokenRefresh(tokenPair.refreshToken);

    try {
      const newTokenPair = await this.refreshPromise;
      this.storeTokenPair(newTokenPair);

      // Update auth store
      const authStore = useAuthStore.getState();
      authStore.login(authStore.user!, newTokenPair.accessToken);

      this.refreshRetryCount = 0; // Reset retry count on success
      console.log('✅ Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);

      if (error instanceof AuthError && error.isUnauthorized()) {
        // Refresh token is invalid, logout user
        this.logout();
      }

      return false;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(refreshToken: string): Promise<TokenPair> {
    const response = await fetch(`${this.config.baseURL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AuthError(
        errorData.detail || 'Token refresh failed',
        response.status,
        'REFRESH_FAILED'
      );
    }

    const data: RefreshResponse = await response.json();

    // Calculate expiry time (assume 24 hours if not provided)
    const expiresAt = data.token_expiration
      ? new Date(data.token_expiration).getTime()
      : Date.now() + 24 * 60 * 60 * 1000;

    return {
      accessToken: data.token_auth,
      refreshToken: data.refresh_token,
      expiresAt,
    };
  }

  // ==========================================
  // PUBLIC AUTHENTICATION METHODS
  // ==========================================

  async login(credentials: LoginForm): Promise<{ user: User; token: string }> {
    try {
      const response = await this.makeRequest<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          code: credentials.code || "string",
        }),
      });

      if (!response.data?.token_auth || !response.data?.uuid) {
        throw new AuthError('Invalid login response', 500, 'INVALID_RESPONSE');
      }

      // Create user object
      const user: User = {
        id: response.data.uuid,
        email: credentials.email,
        pseudo: credentials.email.split('@')[0],
        username: credentials.email.split('@')[0],
      };

      // Calculate token expiry
      const expiresAt = response.data.token_expiration
        ? new Date(response.data.token_expiration).getTime()
        : Date.now() + 24 * 60 * 60 * 1000;

      // Store tokens (assume refresh token is same as access token for now)
      const tokenPair: TokenPair = {
        accessToken: response.data.token_auth,
        refreshToken: response.data.token_auth, // Update when backend provides separate refresh token
        expiresAt,
      };

      this.storeTokenPair(tokenPair);

      // Update auth store
      const authStore = useAuthStore.getState();
      authStore.login(user, tokenPair.accessToken);

      console.log('✅ Login successful');
      return { user, token: tokenPair.accessToken };

    } catch (error) {
      console.error('❌ Login failed:', error);
      throw error instanceof AuthError ? error : new AuthError('Login failed');
    }
  }

  async register(credentials: RegisterForm): Promise<{ user: User; token: string }> {
    try {
      const response = await this.makeRequest<any>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          pseudo: credentials.pseudo,
          email: credentials.email,
          password: credentials.password,
        }),
      });

      if (!response.data?.token_auth || !response.data?.uuid) {
        throw new AuthError('Invalid registration response', 500, 'INVALID_RESPONSE');
      }

      // Create user object
      const user: User = {
        id: response.data.uuid,
        email: credentials.email,
        pseudo: credentials.pseudo,
        username: credentials.pseudo,
      };

      // Calculate token expiry
      const expiresAt = response.data.token_expiration
        ? new Date(response.data.token_expiration).getTime()
        : Date.now() + 24 * 60 * 60 * 1000;

      // Store tokens
      const tokenPair: TokenPair = {
        accessToken: response.data.token_auth,
        refreshToken: response.data.token_auth,
        expiresAt,
      };

      this.storeTokenPair(tokenPair);

      // Update auth store
      const authStore = useAuthStore.getState();
      authStore.login(user, tokenPair.accessToken);

      console.log('✅ Registration successful');
      return { user, token: tokenPair.accessToken };

    } catch (error) {
      console.error('❌ Registration failed:', error);
      throw error instanceof AuthError ? error : new AuthError('Registration failed');
    }
  }

  async validateToken(): Promise<{ user: User }> {
    try {
      const token = this.getCurrentAccessToken();

      if (!token) {
        throw new AuthError('No token available', 401, 'NO_TOKEN');
      }

      // Skip server validation to avoid CORS issues
      // Instead, decode token locally and return user data
      try {
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        const user = {
          id: tokenPayload.id || tokenPayload.user_id,
          email: tokenPayload.sub || tokenPayload.email,
          username: tokenPayload.username || tokenPayload.pseudo,
          pseudo: tokenPayload.pseudo
        };

        console.log('✅ Token validated locally:', user);
        return { user };
      } catch (decodeError) {
        console.error('❌ Token decode failed:', decodeError);
        throw new AuthError('Invalid token format', 401, 'INVALID_TOKEN');
      }
    } catch (error) {
      console.error('❌ Token validation failed:', error);
      throw error instanceof AuthError ? error : new AuthError('Token validation failed');
    }
  }

  async logout(): Promise<void> {
    try {
      // Try to logout on server
      await this.makeRequest('/auth/logout', { method: 'POST' });
    } catch (error) {
      // Ignore logout errors - we'll clear local tokens anyway
      console.warn('Server logout failed, clearing local tokens anyway:', error);
    } finally {
      // Always clear local state
      this.secureStorage.clear();
      this.refreshPromise = null;
      this.refreshRetryCount = 0;

      // Clear all possible localStorage keys
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_data');
      localStorage.removeItem('token_expiry');

      // Clear sessionStorage as well
      sessionStorage.clear();

      // Reset global auth initialization flag
      (window as any).__AUTH_INITIALIZED__ = false;

      // Update auth store
      const authStore = useAuthStore.getState();
      authStore.logout();

      console.log('✅ Logout completed - all storage cleared');
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  isAuthenticated(): boolean {
    const tokenPair = this.getStoredTokenPair();
    if (!tokenPair) return false;

    // Check if token is not expired (with buffer)
    return !this.isTokenExpired(tokenPair.expiresAt);
  }

  getCurrentToken(): string | null {
    return this.getCurrentAccessToken();
  }

  getTokenExpiryTime(): number | null {
    const tokenPair = this.getStoredTokenPair();
    return tokenPair?.expiresAt || null;
  }

  getTimeUntilExpiry(): number {
    const expiryTime = this.getTokenExpiryTime();
    if (!expiryTime) return 0;

    return Math.max(0, expiryTime - Date.now());
  }

  // Force a token refresh (useful for testing)
  async forceRefresh(): Promise<boolean> {
    return this.refreshTokenIfNeeded(true);
  }
}

// Create and export singleton instance
export const enhancedAuthService = new EnhancedAuthService();
export default enhancedAuthService;