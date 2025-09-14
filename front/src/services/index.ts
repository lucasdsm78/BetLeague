// Re-export all services
export { default as apiClient, ApiClientError } from './apiClient';
export { default as authService, AuthError } from './authService';
export { default as leagueService, LeagueServiceError } from './leagueService';

// Import for type checking and usage
import apiClient, { ApiClientError } from './apiClient';
import authService, { AuthError } from './authService';
import { LeagueServiceError } from './leagueService';

// Service initialization and configuration
export const initializeServices = () => {
  console.log('Services initialized');
};

// Global error handlers
export const handleServiceError = (error: any): string => {
  if (error instanceof AuthError) {
    return error.getDisplayMessage?.() || error.message;
  }
  
  if (error instanceof LeagueServiceError) {
    return error.message;
  }
  
  if (error instanceof ApiClientError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'Une erreur inconnue s\'est produite';
};

// Service health check
export const checkServicesHealth = async (): Promise<{ 
  api: boolean; 
  auth: boolean; 
  league: boolean; 
}> => {
  const results = {
    api: false,
    auth: false,
    league: false,
  };

  try {
    // Check API health
    const response = await apiClient.get('/health');
    results.api = response.success;
  } catch {
    results.api = false;
  }

  try {
    // Check auth service (if authenticated)
    if (authService.isAuthenticated()) {
      await authService.validateToken();
      results.auth = true;
    } else {
      results.auth = true; // Not authenticated is fine
    }
  } catch {
    results.auth = false;
  }

  results.league = results.api; // League service depends on API

  return results;
};