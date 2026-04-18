// DTOs et utilitaires de types pour les réponses API

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

// Format de réponse standardisé côté front (suite à l'unification autour de secureApiClient)
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: number;
  headers?: Record<string, string>;
}

export interface ApiPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
