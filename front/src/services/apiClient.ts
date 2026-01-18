/**
 * @deprecated
 * Ce projet utilise désormais `services/http.ts` (alias de `services/secureApiClient.ts`).
 * Ce fichier est conservé uniquement pour compatibilité avec du code legacy.
 *
 * ✅ Source de vérité: `import http from './http'`
 */

import http, { type ApiResponse, type RequestConfig } from './http';

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
}

class ApiClient {
  async get<T>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return http.get<T>(endpoint, config);
  }

  async post<T>(endpoint: string, data?: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return http.post<T>(endpoint, data, config);
  }

  async put<T>(endpoint: string, data?: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return http.put<T>(endpoint, data, config);
  }

  async patch<T>(endpoint: string, data?: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return http.patch<T>(endpoint, data, config);
  }

  async delete<T>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return http.delete<T>(endpoint, config);
  }
}

export const apiClient = new ApiClient();

export default apiClient;
