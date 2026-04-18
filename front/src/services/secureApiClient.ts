/**
 * Secure API Client - Enhanced HTTP client with automatic token refresh
 * Handles authentication, retries, and security best practices
 */

import enhancedAuthService, { AuthError } from './authService.enhanced';

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

  constructor(message: string, opts: { status: number; code?: string; details?: unknown; headers?: Record<string, string> }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
    this.headers = opts.headers ?? {};
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

      const response = await this.executeRequest(url, config);
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
        const parsed = await this.parseErrorResponse(error);
        throw new ApiClientError(parsed.message, {
          status: error.status,
          code: parsed.code,
          details: parsed.details,
          headers,
        });
      }

      throw this.handleError(error);
    }
  }

  // ==========================================
  // REQUEST EXECUTION WITH TOKEN MANAGEMENT
  // ==========================================

  private async executeRequest(
    url: string,
    config: RequestConfig
  ): Promise<Response> {
    const requestConfig = await this.prepareRequest(config);

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

  private async prepareRequest(config: RequestConfig): Promise<RequestInit> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(config.headers as Record<string, string> || {}),
    };

    // Add authentication header
    if (!config.skipAuth) {
      const token = enhancedAuthService.getCurrentToken();

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else if (!config.skipAuth) {
        console.warn('⚠️ No token available for authenticated request');
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

    this.logResponse(requestId, status, headers);

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
      throw new ApiClientError('Failed to parse response', {
        status,
        code: 'PARSE_ERROR',
        details: error,
        headers,
      });
    }
  }

  private async parseErrorResponse(response: Response): Promise<{ message: string; details?: unknown; code?: string }> {
    const status = response.status;

    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorData: any = await response.json();
        const detail = errorData?.detail;

        const message =
          (typeof detail === 'string' && detail) ||
          (detail?.message as string) ||
          (errorData?.message as string) ||
          response.statusText ||
          'Request failed';

        const code = detail?.code || errorData?.code;

        return {
          message,
          details: errorData,
          code,
        };
      }

      const text = await response.text();
      return {
        message: text || response.statusText || 'Request failed',
        details: text,
      };
    } catch {
      return {
        message: response.statusText || 'Request failed',
      };
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  private generateRequestId(): string {
    return Math.random().toString(36).substr(2, 9);
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

  private handleError(error: any): ApiClientError {
    // Erreur déjà normalisée
    if (error instanceof ApiClientError) return error;

    // Timeout / network issus de AuthError
    if (error instanceof AuthError) {
      return new ApiClientError(error.message, {
        status: (error as any).status ?? 0,
        code: (error as any).code,
        details: (error as any).data ?? (error as any).details,
        headers: {},
      });
    }

    // fetch network error
    if (error?.name === 'TypeError' && String(error?.message || '').includes('Failed to fetch')) {
      return new ApiClientError('Network error', { status: 0, code: 'NETWORK_ERROR', details: error, headers: {} });
    }

    // Fallback
    return new ApiClientError(error?.message || 'Unknown error', { status: 0, code: 'UNKNOWN_ERROR', details: error, headers: {} });
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

    // Ne jamais logger les headers (tokens). On log uniquement method+url.
    console.group(`🔄 API Request [${id}] ${method} ${url}`);
    console.groupEnd();
  }

  private logResponse(
    id: string,
    status: number,
    headers: Record<string, string>
  ): void {
    if (!this.config.enableRequestLogging) return;

    const statusIcon = status < 400 ? '✅' : '❌';
    // eslint-disable-next-line no-console
    console.log(`${statusIcon} API Response [${id}] status=${status}`);
  }

  private logError(id: string, error: any): void {
    if (!this.config.enableRequestLogging) return;

    console.error(`❌ API Error [${id}]:`, error);
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
  enableRequestLogging: process.env.NODE_ENV === 'development',
  enableResponseCaching: true,
});

export default secureApiClient;
