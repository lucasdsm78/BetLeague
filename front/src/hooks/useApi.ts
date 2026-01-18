/**
 * API Hook - TypeScript version
 * Centralized API state management with caching and error handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import http, { type ApiResponse, type RequestConfig } from '../services/http';
import { ApiClientError } from '../services/apiClient';

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
}

export interface UseApiOptions<T> {
  immediate?: boolean;
  cacheKey?: string;
  cacheTime?: number;
  retryAttempts?: number;
  retryDelay?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: ApiClientError) => void;
  transform?: (data: any) => T;
  shouldFetch?: () => boolean;
}

export interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<T | null>;
  refetch: () => Promise<T | null>;
  mutate: (data: T | null) => void;
  reset: () => void;
  lastFetch: number | null;
}

// Simple in-memory cache
class ApiCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  clearExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

const apiCache = new ApiCache();

// Cleanup expired cache entries periodically
setInterval(() => apiCache.clearExpired(), 5 * 60 * 1000);

export function useApi<T = any>(
  endpoint: string,
  config: RequestConfig = {},
  options: UseApiOptions<T> = {}
): UseApiReturn<T> {
  const {
    immediate = false,
    cacheKey,
    cacheTime = 5 * 60 * 1000,
    retryAttempts = 0,
    retryDelay = 1000,
    onSuccess,
    onError,
    transform,
    shouldFetch,
  } = options;

  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const effectKey = `${endpoint}-${JSON.stringify(config)}`;
  const finalCacheKey = cacheKey || effectKey;

  // Check cache for data
  const getCachedData = useCallback((): T | null => {
    if (!cacheKey) return null;
    return apiCache.get(finalCacheKey);
  }, [finalCacheKey, cacheKey]);

  // Set cache data
  const setCachedData = useCallback((data: T) => {
    if (cacheKey) {
      apiCache.set(finalCacheKey, data, cacheTime);
    }
  }, [finalCacheKey, cacheKey, cacheTime]);

  // Sleep utility for retries
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Fetch data function
  const fetchData = useCallback(async (useCache = true): Promise<T | null> => {
    try {
      // Check if fetch should proceed
      if (shouldFetch && !shouldFetch()) {
        return state.data;
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Check cache first
      if (useCache) {
        const cachedData = getCachedData();
        if (cachedData) {
          setState(prev => ({
            ...prev,
            data: cachedData,
            loading: false,
            error: null,
            lastFetch: Date.now(),
          }));
          return cachedData;
        }
      }

      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
      }));

      abortControllerRef.current = new AbortController();

      let lastError: ApiClientError | null = null;
      let result: T | null = null;

      // Retry logic
      for (let attempt = 0; attempt <= retryAttempts; attempt++) {
        try {
          const requestConfig = {
            ...config,
            headers: {
              ...config.headers,
            },
          };

          const parseBody = (rawBody: unknown) => {
            if (!rawBody) return undefined;
            if (typeof rawBody === 'string') {
              try {
                return JSON.parse(rawBody);
              } catch {
                return undefined;
              }
            }
            return undefined;
          };

          let response: ApiResponse<T>;

          switch (config.method?.toUpperCase()) {
            case 'POST':
              response = await http.post<T>(endpoint, parseBody(config.body), requestConfig);
              break;
            case 'PUT':
              response = await http.put<T>(endpoint, parseBody(config.body), requestConfig);
              break;
            case 'PATCH':
              response = await http.patch<T>(endpoint, parseBody(config.body), requestConfig);
              break;
            case 'DELETE':
              response = await http.delete<T>(endpoint, requestConfig);
              break;
            default:
              response = await http.get<T>(endpoint, requestConfig);
          }

          if (!response.success) {
            throw new ApiClientError(response.error || 'Request failed');
          }

          // Transform data if transformer provided
          const finalData = transform && response.data ? transform(response.data) : response.data;
          result = finalData as T;

          // Cache successful response
          if (result) {
            setCachedData(result);
          }

          break; // Success, exit retry loop

        } catch (error) {
          if (error instanceof ApiClientError) {
            lastError = error;

            // Don't retry client errors (4xx) except 429
            if (error.status >= 400 && error.status < 500 && error.status !== 429) {
              break;
            }
          } else {
            lastError = new ApiClientError('Network error');
          }

          // Don't wait after last attempt
          if (attempt < retryAttempts) {
            await sleep(retryDelay * Math.pow(2, attempt));
          }
        }
      }

      if (lastError) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: lastError!.message,
        }));

        if (onError) {
          onError(lastError);
        }

        throw lastError;
      }

      setState(prev => ({
        ...prev,
        data: result,
        loading: false,
        error: null,
        lastFetch: Date.now(),
      }));

      if (result && onSuccess) {
        onSuccess(result);
      }

      return result;

    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : new ApiClientError('Unknown error');

      setState(prev => ({
        ...prev,
        loading: false,
        error: apiError.message,
      }));

      if (onError) {
        onError(apiError);
      }

      return null;
    }
  }, [
    endpoint,
    config,
    shouldFetch,
    state.data,
    getCachedData,
    setCachedData,
    transform,
    retryAttempts,
    retryDelay,
    onSuccess,
    onError,
  ]);

  // Refetch (bypass cache)
  const refetch = useCallback(() => {
    return fetchData(false);
  }, [fetchData]);

  // Manual data mutation (optimistic updates)
  const mutate = useCallback((data: T | null) => {
    setState(prev => ({
      ...prev,
      data,
      error: null,
      lastFetch: Date.now(),
    }));

    if (data && cacheKey) {
      setCachedData(data);
    }
  }, [cacheKey, setCachedData]);

  // Reset state
  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      lastFetch: null,
    });

    if (cacheKey) {
      apiCache.clear(finalCacheKey);
    }
  }, [cacheKey, finalCacheKey]);

  // Initial fetch on mount
  useEffect(() => {
    if (immediate) {
      fetchData();
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [immediate]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    fetch: () => fetchData(true),
    refetch,
    mutate,
    reset,
    lastFetch: state.lastFetch,
  };
}

// Specialized hooks
export function useApiQuery<T = any>(
  endpoint: string,
  options: UseApiOptions<T> = {}
): UseApiReturn<T> {
  return useApi<T>(endpoint, { method: 'GET' }, { immediate: true, ...options });
}

export function useApiMutation<T = any>(
  endpoint: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
): {
  mutate: (data?: any) => Promise<T | null>;
  loading: boolean;
  error: string | null;
  reset: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (data?: any): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);

      // (RequestConfig legacy) on envoie directement `data` comme body JSON via http
      let response: ApiResponse<T>;

      switch (method) {
        case 'POST':
          response = await http.post<T>(endpoint, data);
          break;
        case 'PUT':
          response = await http.put<T>(endpoint, data);
          break;
        case 'PATCH':
          response = await http.patch<T>(endpoint, data);
          break;
        case 'DELETE':
          response = await http.delete<T>(endpoint);
          break;
      }

      if (!response.success) {
        throw new ApiClientError(response.error || 'Mutation failed');
      }

      return response.data as T;

    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : new ApiClientError('Unknown error');
      setError(apiError.message);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [endpoint, method]);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

// Cache management utilities
export const apiCacheUtils = {
  clear: (key?: string) => apiCache.clear(key),
  clearExpired: () => apiCache.clearExpired(),
};
