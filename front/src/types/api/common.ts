/**
 * Types API communs
 *
 * Convention: ces types représentent la forme des réponses côté backend.
 * - snake_case conservé si retourné tel quel par l'API
 * - aucun mapping UI ici
 */

export interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly message?: string;
  readonly error?: string;
  readonly errors?: Record<string, string[]>;
}

export interface ApiError {
  readonly message: string;
  readonly status: number;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
}

export interface ApiPaginatedResponse<T = unknown> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

