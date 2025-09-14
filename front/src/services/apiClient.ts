/**
 * API Client - Secure and typed HTTP client
 * Centralized API communication with comprehensive error handling
 */

import type { 
  ApiResponse, 
  ApiError, 
  RequestConfig, 
  HttpMethod,
  SecurityContext 
} from '../types';

// API Configuration
export interface ApiClientConfig {
  readonly baseURL: string;
  readonly timeout: number;
  readonly retries: number;
  readonly retryDelay: number;
  readonly maxConcurrentRequests: number;
}

const DEFAULT_CONFIG: ApiClientConfig = {
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8001/api',
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
  maxConcurrentRequests: 10,
};

// Custom Error Classes
export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    status: number = 0,
    code?: string,
    details?: unknown,
    isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.isRetryable = isRetryable;
  }

  static fromResponse(response: Response, data?: unknown): ApiClientError {
    const isRetryable = response.status >= 500 || response.status === 429;
    return new ApiClientError(
      `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      response.status.toString(),
      data,
      isRetryable
    );
  }

  static networkError(error: Error): ApiClientError {
    return new ApiClientError(
      'Network error: Unable to reach the server',
      0,
      'NETWORK_ERROR',
      error,
      true
    );
  }

  static timeoutError(): ApiClientError {
    return new ApiClientError(
      'Request timeout: Server took too long to respond',
      408,
      'TIMEOUT_ERROR',
      undefined,
      true
    );
  }
}

// Request Queue Management
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private running: number = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      });

      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const request = this.queue.shift();
    if (request) {
      this.running++;
      request();
    }
  }
}

// Rate Limiter
class RateLimiter {
  private requests: number[] = [];
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number = 100, windowMs: number = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.limit) {
      return false;
    }

    this.requests.push(now);
    return true;
  }

  getResetTime(): number {
    if (this.requests.length === 0) return 0;
    return Math.max(0, this.requests[0] + this.windowMs - Date.now());
  }
}

// Main API Client Class
export class ApiClient {
  private readonly config: ApiClientConfig;
  private readonly requestQueue: RequestQueue;
  private readonly rateLimiter: RateLimiter;
  private abortController?: AbortController;

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.requestQueue = new RequestQueue(this.config.maxConcurrentRequests);
    this.rateLimiter = new RateLimiter(100, 60000); // 100 req/min
  }

  // Get authentication headers
  private getAuthHeaders(): Record<string, string> {
    const token = this.getStoredToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'BetLeague/1.0',
    };

    if (token) {
      headers['X-Authentication'] = `Bearer ${token}`;
    }

    return headers;
  }

  // Get stored token securely
  private getStoredToken(): string | null {
    try {
      return localStorage.getItem('authToken');
    } catch {
      return null;
    }
  }

  // Validate and sanitize URL
  private buildUrl(endpoint: string): string {
    // Remove leading slash if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    
    // Validate endpoint format
    if (!/^[a-zA-Z0-9\/_-]+(\?[a-zA-Z0-9&=_-]*)?$/.test(cleanEndpoint)) {
      throw new ApiClientError('Invalid endpoint format', 400);
    }

    return `${this.config.baseURL}/${cleanEndpoint}`;
  }

  // Sleep utility for retries
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Make HTTP request with retries
  private async makeRequest<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    // Rate limiting check
    if (!this.rateLimiter.canMakeRequest()) {
      const resetTime = this.rateLimiter.getResetTime();
      throw new ApiClientError(
        `Rate limit exceeded. Try again in ${Math.ceil(resetTime / 1000)} seconds`,
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    const url = this.buildUrl(endpoint);
    const method = config.method || 'GET';
    
    // Prepare request configuration
    this.abortController = new AbortController();
    const timeoutId = setTimeout(
      () => this.abortController?.abort(),
      config.timeout || this.config.timeout
    );

    const requestConfig: RequestInit = {
      method,
      headers: {
        ...this.getAuthHeaders(),
        ...config.headers,
      },
      body: config.body,
      signal: this.abortController.signal,
      credentials: 'include',
    };

    let lastError: ApiClientError | null = null;
    const maxRetries = config.retries ?? this.config.retries;

    // Retry loop
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, requestConfig);
        clearTimeout(timeoutId);

        // Handle different response types
        if (!response.ok) {
          const errorData = await this.safeParseJson(response);
          const error = ApiClientError.fromResponse(response, errorData);
          
          // Don't retry client errors (4xx) except 429
          if (response.status < 500 && response.status !== 429) {
            throw error;
          }
          
          lastError = error;
          
          // Don't retry on last attempt
          if (attempt === maxRetries) {
            throw error;
          }
          
          // Wait before retry with exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }

        // Parse successful response
        const data = await this.safeParseJson<T>(response);
        
        return {
          success: true,
          data: data as T,
          message: 'Request successful',
        };

      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof ApiClientError) {
          lastError = error;
        } else if (error instanceof Error) {
          if (error.name === 'AbortError') {
            lastError = ApiClientError.timeoutError();
          } else {
            lastError = ApiClientError.networkError(error);
          }
        } else {
          lastError = new ApiClientError('Unknown error occurred');
        }

        // Don't retry on last attempt or non-retryable errors
        if (attempt === maxRetries || !lastError.isRetryable) {
          break;
        }

        // Wait before retry
        const delay = this.config.retryDelay * Math.pow(2, attempt);
        await this.sleep(delay);
      }
    }

    // All retries failed
    throw lastError || new ApiClientError('Request failed after all retries');
  }

  // Safely parse JSON response
  private async safeParseJson<T>(response: Response): Promise<T | any> {
    const text = await response.text();
    
    if (!text.trim()) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      // Return text if not valid JSON
      return text;
    }
  }

  // Public HTTP methods
  async get<T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.requestQueue.add(() => 
      this.makeRequest<T>(endpoint, { ...config, method: 'GET' })
    );
  }

  async post<T>(endpoint: string, data?: any, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.requestQueue.add(() =>
      this.makeRequest<T>(endpoint, {
        ...config,
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      })
    );
  }

  async put<T>(endpoint: string, data?: any, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.requestQueue.add(() =>
      this.makeRequest<T>(endpoint, {
        ...config,
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
      })
    );
  }

  async patch<T>(endpoint: string, data?: any, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.requestQueue.add(() =>
      this.makeRequest<T>(endpoint, {
        ...config,
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
      })
    );
  }

  async delete<T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.requestQueue.add(() =>
      this.makeRequest<T>(endpoint, { ...config, method: 'DELETE' })
    );
  }

  // Cancel all ongoing requests
  cancelRequests(): void {
    this.abortController?.abort();
  }

  // Get rate limit status
  getRateLimitStatus(): { remaining: number; resetTime: number } {
    return {
      remaining: Math.max(0, 100 - this.rateLimiter['requests'].length),
      resetTime: this.rateLimiter.getResetTime(),
    };
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient();

export default apiClient;