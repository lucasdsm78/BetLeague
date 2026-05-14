/**
 * Secure API Client - Enhanced HTTP client with automatic token refresh
 * Handles authentication, retries, and security best practices
 */

import enhancedAuthService, { AuthError } from './authService.enhanced';
import { createLogger, serializeError } from '../utils/logger';

const logger = createLogger('apiClient');

function getDefaultHttpErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Requête invalide.';
    case 401:
      return 'Authentification requise.';
    case 403:
      return 'Accès refusé.';
    case 404:
      return 'Ressource introuvable.';
    case 408:
      return 'Le délai de la requête a expiré.';
    case 409:
      return 'Conflit détecté.';
    case 422:
      return 'Données invalides.';
    case 429:
      return 'Trop de tentatives, réessayez plus tard.';
    default:
      if (status >= 500) return 'Erreur interne du serveur.';
      return 'La requête a échoué.';
  }
}

// Types for API client
export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  enableTokenRefresh: boolean;
  enableRequestLogging: boolean;
  enableResponseCaching: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status: number;
  headers: Record<string, string>;
}

export interface RequestConfig extends RequestInit {
  skipAuth?: boolean;
  skipRetry?: boolean;
  timeout?: number;
  retries?: number;
  skipCache?: boolean;
}

// Request queue for managing concurrent requests during token refresh
interface QueuedRequest {
  request: () => Promise<Response>;
  resolve: (value: Response) => void;
  reject: (error: any) => void;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;
  public readonly headers: Record<string, string>;
  public readonly requestId?: string;

  constructor(message: string, opts: { status: number; code?: string; details?: unknown; headers?: Record<string, string>; requestId?: string }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
    this.headers = opts.headers ?? {};
    this.requestId = opts.requestId;
  }
}

class SecureApiClient {
  private config: ApiClientConfig;
  private isRefreshing = false;
  private requestQueue: QueuedRequest[] = [];
  private requestCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = {
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8001/api',
      timeout: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      enableTokenRefresh: true,
      enableRequestLogging: false,
      enableResponseCaching: false,
      ...config,
    };
  }

  // ==========================================
  // CORE HTTP METHODS
  // ==========================================

  async get<T = any>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T = any>(endpoint: string, data?: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  async patch<T = any>(endpoint: string, data?: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // ==========================================
  // MAIN REQUEST HANDLER
  // ==========================================

  private async request<T = any>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseURL}${endpoint}`;
    const requestId = this.generateRequestId();

    try {
      this.logRequest(requestId, config.method || 'GET', url, config);

      // Check cache first
      if (config.method === 'GET' && this.config.enableResponseCaching && !config.skipCache) {
        const cached = this.getCachedResponse<T>(url);
        if (cached) {
          this.logRequest(requestId, 'CACHE', url, { fromCache: true });
          return {
            success: true,
            data: cached,
            status: 200,
            headers: {},
          };
        }
      }

      const response = await this.executeRequest(url, config, requestId);
      const result = await this.handleResponse<T>(response, requestId);

      // Cache GET responses
      if (
        config.method === 'GET' &&
        result.success &&
        this.config.enableResponseCaching &&
        !config.skipCache
      ) {
        this.setCachedResponse(url, result.data, 5 * 60 * 1000); // 5 minutes TTL
      }

      return result;
    } catch (error) {
      this.logError(requestId, error);

      if (error instanceof ApiClientError) {
        throw error;
      }

      if (error instanceof Response) {
        const headers = this.extractHeaders(error);
        const responseRequestId = this.getResponseRequestId(headers, requestId);
        const parsed = await this.parseErrorResponse(error);
        throw new ApiClientError(parsed.message, {
          status: error.status,
          code: parsed.code,
          details: parsed.details,
          headers,
          requestId: responseRequestId,
        });
      }

      throw this.handleError(error, requestId);
    }
  }

  // ==========================================
  // REQUEST EXECUTION WITH TOKEN MANAGEMENT
  // ==========================================

  private async executeRequest(
    url: string,
    config: RequestConfig,
    requestId: string
  ): Promise<Response> {
    const requestConfig = await this.prepareRequest(config, requestId);

    // Handle concurrent requests during token refresh
    if (this.isRefreshing && this.config.enableTokenRefresh && !config.skipAuth) {
      return new Promise((resolve, reject) => {
        this.requestQueue.push({
          request: () => this.performRequest(url, requestConfig),
          resolve,
          reject,
        });
      });
    }

    const response = await this.performRequest(url, requestConfig);

    // Handle 401 responses with token refresh
    if (
      response.status === 401 &&
      this.config.enableTokenRefresh &&
      !config.skipAuth &&
      !config.skipRetry
    ) {
      return this.handleUnauthorizedResponse(url, requestConfig);
    }

    return response;
  }

  private async prepareRequest(config: RequestConfig, requestId: string): Promise<RequestInit> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Request-Id': requestId,
      ...(config.headers as Record<string, string> || {}),
    };

    // Add authentication header
    if (!config.skipAuth) {
      const token = enhancedAuthService.getCurrentToken();

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else if (!config.skipAuth) {
        logger.warn('authenticated request without access token', {
          requestId,
          method: config.method || 'GET',
        });
      }
    }

    // Add CSRF protection
    const csrfToken = this.getCSRFToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    return {
      ...config,
      headers,
      credentials: 'include',
    };
  }

  private async performRequest(
    url: string,
    config: RequestInit
  ): Promise<Response> {
    const timeout = (config as RequestConfig).timeout || this.config.timeout;

    // Create request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new AuthError('Request timeout', 408, 'TIMEOUT');
      }

      throw error;
    }
  }

  // ==========================================
  // TOKEN REFRESH HANDLING
  // ==========================================

  private async handleUnauthorizedResponse(
    url: string,
    config: RequestInit
  ): Promise<Response> {
    if (this.isRefreshing) {
      // Wait for ongoing refresh
      return new Promise((resolve, reject) => {
        this.requestQueue.push({
          request: () => this.performRequest(url, config),
          resolve,
          reject,
        });
      });
    }

    this.isRefreshing = true;

    try {
      const refreshed = await enhancedAuthService.forceRefresh();

      if (refreshed) {
        // Update token in config and retry
        const newToken = enhancedAuthService.getCurrentToken();
        const updatedConfig = {
          ...config,
          headers: {
            ...config.headers,
            Authorization: newToken ? `Bearer ${newToken}` : '',
          },
        };

        // Process queued requests
        this.processRequestQueue();

        // Retry original request
        return this.performRequest(url, updatedConfig);
      } else {
        throw new AuthError('Token refresh failed', 401, 'REFRESH_FAILED');
      }
    } catch (error) {
      // Clear queue on refresh failure
      this.clearRequestQueue(error);
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  private processRequestQueue(): void {
    const queue = [...this.requestQueue];
    this.requestQueue = [];

    queue.forEach(({ request, resolve, reject }) => {
      request().then(resolve).catch(reject);
    });
  }

  private clearRequestQueue(error: any): void {
    const queue = [...this.requestQueue];
    this.requestQueue = [];

    queue.forEach(({ reject }) => {
      reject(error);
    });
  }

  // ==========================================
  // RESPONSE HANDLING
  // ==========================================

  private async handleResponse<T>(
    response: Response,
    requestId: string
  ): Promise<ApiResponse<T>> {
    const status = response.status;
    const headers = this.extractHeaders(response);
    const responseRequestId = this.getResponseRequestId(headers, requestId);

    this.logResponse(requestId, status, responseRequestId);

    // Handle No Content explicitly to avoid parsing errors
    if (status === 204) {
      return {
        success: true,
        data: undefined as unknown as T,
        status,
        headers,
      };
    }

    if (!response.ok) {
      const parsed = await this.parseErrorResponse(response);
      throw new ApiClientError(parsed.message, {
        status,
        code: parsed.code,
        details: parsed.details,
        headers,
        requestId: responseRequestId,
      });
    }

    try {
      // Handle 204 No Content specifically
      if (status === 204) {
        return {
          success: true,
          data: null as unknown as T,
          status,
          headers,
        };
      }

      // Handle different content types
      const contentType = response.headers.get('content-type') || '';

      let data: T;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType.includes('text/')) {
        data = (await response.text()) as unknown as T;
      } else if (contentType) {
        data = (await response.blob()) as unknown as T;
      } else {
        // Fallback when no content-type is provided
        data = undefined as unknown as T;
      }

      return {
        success: true,
        data,
        status,
        headers,
      };
    } catch (error) {
      // Parsing error => erreur cliente (statut conservé)
      throw new ApiClientError('Impossible de lire la réponse du serveur.', {
        status,
        code: 'PARSE_ERROR',
        details: error,
        headers,
        requestId: responseRequestId,
      });
    }
  }

  private async parseErrorResponse(response: Response): Promise<{ message: string; details?: unknown; code?: string }> {
    try {
      const fallbackMessage = getDefaultHttpErrorMessage(response.status);
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorData: any = await response.json();
        const detail = errorData?.detail;

        const message =
          (typeof detail === 'string' && detail) ||
          (detail?.message as string) ||
          (errorData?.message as string) ||
          fallbackMessage;

        const code = detail?.code || errorData?.code;

        return {
          message,
          details: errorData,
          code,
        };
      }

      const text = await response.text();
      return {
        message: text || fallbackMessage,
        details: text,
      };
    } catch {
      return {
        message: getDefaultHttpErrorMessage(response.status),
      };
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  private generateRequestId(): string {
    const cryptoApi = globalThis.crypto as Crypto | undefined;
    if (cryptoApi?.randomUUID) {
      return cryptoApi.randomUUID();
    }
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private getResponseRequestId(headers: Record<string, string>, fallback: string): string {
    return headers['x-request-id'] || headers['X-Request-Id'] || fallback;
  }

  private extractHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  private getCSRFToken(): string | null {
    // Get CSRF token from meta tag or cookie
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    return metaTag?.getAttribute('content') || null;
  }

  private handleError(error: any, requestId?: string): ApiClientError {
    // Erreur déjà normalisée
    if (error instanceof ApiClientError) return error;

    // Timeout / network issus de AuthError
    if (error instanceof AuthError) {
      return new ApiClientError(error.message, {
        status: (error as any).status ?? 0,
        code: (error as any).code,
        details: (error as any).data ?? (error as any).details,
        headers: {},
        requestId,
      });
    }

    // fetch network error
    if (error?.name === 'TypeError' && String(error?.message || '').includes('Failed to fetch')) {
      return new ApiClientError('Erreur réseau. Vérifiez votre connexion.', { status: 0, code: 'NETWORK_ERROR', details: error, headers: {}, requestId });
    }

    // Fallback
    return new ApiClientError(error?.message || 'Une erreur inconnue est survenue.', { status: 0, code: 'UNKNOWN_ERROR', details: error, headers: {}, requestId });
  }

  // ==========================================
  // CACHING
  // ==========================================

  private getCachedResponse<T>(key: string): T | null {
    const cached = this.requestCache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.timestamp + cached.ttl) {
      this.requestCache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCachedResponse(key: string, data: any, ttl: number): void {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  // ==========================================
  // LOGGING
  // ==========================================

  private logRequest(
    id: string,
    method: string,
    url: string,
    config: any
  ): void {
    if (!this.config.enableRequestLogging) return;

    logger.debug('request.started', {
      requestId: id,
      method,
      url,
      skipAuth: Boolean(config?.skipAuth),
      skipCache: Boolean(config?.skipCache),
      fromCache: Boolean(config?.fromCache),
    });
  }

  private logResponse(
    id: string,
    status: number,
    responseRequestId: string
  ): void {
    if (!this.config.enableRequestLogging) return;

    logger.debug('request.completed', {
      requestId: id,
      responseRequestId,
      status,
    });
  }

  private logError(id: string, error: any): void {
    const normalized = error instanceof ApiClientError
      ? serializeError(error)
      : serializeError(this.handleError(error, id));
    const status = Number(normalized.status || 0);
    const level = status >= 500 || status === 0 ? 'error' : 'warn';
    logger[level]('request.failed', {
      requestId: id,
      ...normalized,
    });
  }

  // ==========================================
  // PUBLIC UTILITIES
  // ==========================================

  public clearCache(): void {
    this.requestCache.clear();
  }

  public getCacheSize(): number {
    return this.requestCache.size;
  }

  public updateConfig(updates: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public getConfig(): ApiClientConfig {
    return { ...this.config };
  }
}

// Create and export singleton instance
export const secureApiClient = new SecureApiClient({
  enableRequestLogging: process.env.REACT_APP_DEBUG === 'true',
  enableResponseCaching: true,
});

export default secureApiClient;
