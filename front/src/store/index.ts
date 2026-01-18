/**
 * Store Index - Main store exports and configuration
 */

// Re-export all stores
export { default as useAuthStore, useSessionManager } from './authStore';
export { default as useLeagueStore } from './leagueStore';

// Direct imports for functions
import useAuthStore from './authStore';
import useLeagueStore from './leagueStore';

// Re-export selectors for convenience
export {
  useAuthUser,
  useAuthToken,
  useAuthError,
  useAuthLoading,
  useIsAuthenticated,
  useHasPermission,
  useHasRole,
  useSecurityContext,
} from './authStore';

export {
  useLeagues,
  useCurrentLeague,
  useInvitations,
  useLeagueLoading,
  useLeagueError,
  useLeagueFilters,
  useLeaguePagination,
  useActiveInvitations,
  useLeagueById,
  useUserLeagues,
} from './leagueStore';

// Store initialization and cleanup utilities
export const initializeStores = () => {
  // Initialize stores if needed
};

export const clearAllStores = () => {
  // Clear all store data
  useAuthStore.getState().logout();
  useLeagueStore.setState((state: any) => {
    state.leagues = [];
    state.currentLeague = null;
    state.invitations = [];
    state.isLoading = false;
    state.error = null;
    state.filters = {
      search: '',
      status: '',
      dateFrom: '',
      dateTo: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };
    state.pagination = {
      currentPage: 1,
      pageSize: 10,
      totalItems: 0,
    };
  });

};

// Store persist configuration
export const STORE_VERSION = '1.0.0';

export const STORE_CONFIG = {
  AUTH_STORE_KEY: 'auth-store',
  LEAGUE_STORE_KEY: 'league-store',
  STORAGE_VERSION: STORE_VERSION,
} as const;

// Store debugging utilities (development only)
if (process.env.NODE_ENV === 'development') {
  // Add stores to window for debugging
  (window as any).__STORES__ = {
    auth: useAuthStore,
    league: useLeagueStore,
  };
}
