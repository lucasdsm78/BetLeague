// ⚠️ Déprécié: n'utilisez plus `services/index.ts` comme barrel.
// Objectif: unifier le client HTTP autour de `services/http.ts` (alias de `secureApiClient`).
// Importez directement depuis `services/http` ou `services/secureApiClient`.

export { default as http } from './http';
export { default as secureApiClient } from './secureApiClient';
export type { ApiResponse, RequestConfig } from './http';

// Helpers génériques (sans dépendre d'un client spécifique)
export const initializeServices = () => {
  // no-op
};

export const handleServiceError = (error: any): string => {
  if (error instanceof Error) return error.message;
  return 'Une erreur inconnue s\'est produite';
};

// ❌ Supprimé: checkServicesHealth dépendait de l’ancien apiClient (concurrent).
// Si tu veux un health check, on le refera via `http.get('/health')`.
