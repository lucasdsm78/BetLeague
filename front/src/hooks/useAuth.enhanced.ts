/**
 * Enhanced useAuth Hook - Secure authentication with automatic refresh
 * Replaces the original useAuth with enhanced security and token management
 */

import { useState, useEffect, useCallback } from 'react';
import enhancedAuthService, { AuthError } from 'services/authService.enhanced';
import { useAuthStore } from 'store/authStore';
import useTokenMonitor from 'hooks/useTokenMonitor';
import type { LoginForm, RegisterForm } from '../types';
import type { User } from '../store/authStore';
import { createLogger } from '../utils/logger';

const logger = createLogger('useEnhancedAuth');

let authInitializationPromise: Promise<void> | null = null;
let authInitializationResolved = false;
let authInitializationError: AuthError | null = null;

const markAuthInitializationComplete = () => {
  authInitializationResolved = true;
  authInitializationPromise = null;
};

const resetSharedAuthInitialization = () => {
  authInitializationPromise = null;
  authInitializationResolved = false;
  authInitializationError = null;
  (window as any).__AUTH_INITIALIZED__ = false;
};

const ensureSharedAuthInitialization = async (): Promise<void> => {
  if (authInitializationResolved) {
    return;
  }

  if (!authInitializationPromise) {
    const authStore = useAuthStore.getState();
    authStore.setLoading(true);
    authInitializationError = null;
    (window as any).__AUTH_INITIALIZED__ = true;

    authInitializationPromise = (async () => {
      try {
        const restoredSession = await enhancedAuthService.restoreSession();
        const currentAuthStore = useAuthStore.getState();

        if (restoredSession) {
          currentAuthStore.login(restoredSession.user, restoredSession.token);
        } else if (currentAuthStore.isAuthenticated) {
          currentAuthStore.logout();
        }
      } catch (error) {
        if (error instanceof AuthError && error.isUnauthorized()) {
          await enhancedAuthService.logout();
        } else {
          authInitializationError = error instanceof AuthError
            ? error
            : new AuthError('Erreur d\'initialisation');
          useAuthStore.getState().setError(authInitializationError.message);
        }
      } finally {
        useAuthStore.getState().setLoading(false);
        markAuthInitializationComplete();
      }
    })();
  }

  await authInitializationPromise;
};

export interface UseAuthReturn {
  // State
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  // Ajout: savoir si l'initialisation globale est terminée
  initializationComplete?: boolean;

  // Token monitoring
  timeUntilExpiry: number;
  timeUntilRefresh: number;
  isRefreshing: boolean;
  isTokenExpiringSoon: boolean;

  // Actions
  login: (credentials: LoginForm) => Promise<User>;
  register: (credentials: RegisterForm) => Promise<User>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;

  // Helpers
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  getSessionTimeRemaining: () => number;

  // Enhanced features
  forceRefresh: () => Promise<boolean>;
  isUserActive: boolean;
  activityLevel: 'active' | 'idle' | 'away';

  // Recovery / diagnostic
  recoverFromStoredToken?: () => boolean;
  scanLegacyTokens?: () => string[];
  attemptHydrateFromAnyStorage?: () => boolean;
  debugDumpAuth?: () => Record<string, any>;
  hydrateFromPersistedAuthStore?: () => boolean;
}

export interface UseAuthOptions {
  autoRefresh?: boolean;
  activityTracking?: boolean;
  debugMode?: boolean;
  onAuthChange?: (isAuthenticated: boolean) => void;
  onError?: (error: AuthError) => void;
}

export const useEnhancedAuth = (options: UseAuthOptions = {}): UseAuthReturn => {
  const {
    autoRefresh = true,
    activityTracking = true,
    debugMode = false,
    onAuthChange,
    onError,
  } = options;

  // Zustand store
  const {
    isAuthenticated,
    user,
    isLoading,
    error,
    setLoading,
    setError,
    clearError: storeClearError,
    hasPermission,
    hasRole,
  } = useAuthStore();

  // Token monitoring
  const tokenMonitor = useTokenMonitor({
    enableAutoRefresh: autoRefresh,
    enableActivityTracking: activityTracking,
    debugMode,
    refreshThreshold: 5, // 5 minutes before expiry
    activityTimeout: 30, // 30 minutes of inactivity
  });

  // Local state for additional features
  const [initializationComplete, setInitializationComplete] = useState(false);

  // Initialize authentication state on mount
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      if (initializationComplete || authInitializationResolved) {
        if (isMounted) {
          setInitializationComplete(true);
        }
        return;
      }

      try {
        await ensureSharedAuthInitialization();
        if (isMounted) {
          if (authInitializationError && onError) {
            onError(authInitializationError);
          }
          setInitializationComplete(true);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const initError = error instanceof AuthError ? error : new AuthError('Erreur d\'initialisation');
        setError(initError.message);
        if (onError) {
          onError(initError);
        }
        setInitializationComplete(true);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [initializationComplete, setError, onError]);

  // Auth change callback
  useEffect(() => {
    if (onAuthChange) {
      onAuthChange(isAuthenticated);
    }
  }, [isAuthenticated, onAuthChange]);

  // Effet de diagnostic: log à chaque changement d'état principal
  useEffect(() => {
    if (debugMode) {
      logger.debug('state changed', {
        isAuthenticated,
        hasUser: !!user,
        userId: user?.id,
        isLoading,
        initializationComplete,
        token: enhancedAuthService.getCurrentToken() ? '[memory-token]' : null,
      });
    }
  }, [isAuthenticated, user, isLoading, initializationComplete, debugMode]);

  // Enhanced login function
  const login = useCallback(async (credentials: LoginForm): Promise<User> => {
    try {
      setLoading(true);
      storeClearError();
      const { user: loggedInUser, token } = await enhancedAuthService.login(credentials) as any;
      if (token) {
        useAuthStore.getState().login(loggedInUser, token);
      } else {
        const currentToken = enhancedAuthService.getCurrentToken();
        if (currentToken) {
          useAuthStore.getState().login(loggedInUser, currentToken);
        }
      }
      markAuthInitializationComplete();
      (window as any).__AUTH_INITIALIZED__ = true;
      setInitializationComplete(true);
      setLoading(false);
      return loggedInUser;
    } catch (error) {
      if (error instanceof AuthError && (error.code === 'TWO_FACTOR_REQUIRED')) {
        setLoading(false);
        throw error;
      }
      const authError = error instanceof AuthError ? error : new AuthError('Erreur de connexion');
      setError(authError.message);
      setLoading(false);
      if (onError) onError(authError);
      throw authError;
    }
  }, [setLoading, setError, storeClearError, onError]);

  // Enhanced register function - ne connecte PAS automatiquement
  const register = useCallback(async (credentials: RegisterForm): Promise<User> => {
    try {
      setLoading(true);
      storeClearError();
      const { user: registeredUser } = await enhancedAuthService.register(credentials);
      return registeredUser;
    } catch (error) {
      const authError = error instanceof AuthError ? error : new AuthError('Erreur d\'inscription');
      setError(authError.message);
      if (onError) { onError(authError); }
      throw authError;
    } finally { setLoading(false); }
  }, [setLoading, setError, storeClearError, onError]);

  // Enhanced logout function
  const logout = useCallback(async (): Promise<void> => {
    try { setLoading(true); await enhancedAuthService.logout(); }
    catch {} finally { setLoading(false); }
  }, [setLoading]);

  // Refresh session function
  const refreshSession = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) return;

    try {
      logger.debug('refreshing session');
      await enhancedAuthService.forceRefresh();
      logger.debug('session refreshed');
    } catch (error) {
      logger.error('session refresh failed', { error });

      const authError = error instanceof AuthError ? error : new AuthError('Erreur de rafraîchissement');
      setError(authError.message);

      if (onError) {
        onError(authError);
      }
    }
  }, [isAuthenticated, setError, onError]);

  // Force refresh function
  const forceRefresh = useCallback(async (): Promise<boolean> => {
    try {
      const success = await enhancedAuthService.forceRefresh();
      if (!success) {
        throw new AuthError('Force refresh failed');
      }
      return true;
    } catch (error) {
      logger.error('force refresh failed', { error });
      return false;
    }
  }, []);

  // Clear error function
  const clearError = useCallback(() => {
    storeClearError();
  }, [storeClearError]);

  // Get session time remaining
  const getSessionTimeRemaining = useCallback((): number => {
    return enhancedAuthService.getTimeUntilExpiry();
  }, []);

  // Recover from stored token function
  const recoverFromStoredToken = useCallback(() => {
    return false;
  }, []);

  const scanLegacyTokens = useCallback((): string[] => {
    return [];
  }, []);

  const attemptHydrateFromAnyStorage = useCallback((): boolean => {
    return false;
  }, []);

  const debugDumpAuth = useCallback(() => {
    const st = useAuthStore.getState();
    const legacy = scanLegacyTokens();
    return {
      isAuthenticated: st.isAuthenticated,
      hasUser: !!st.user,
      user: st.user,
      tokenSnippet: st.token ? st.token.slice(0,30)+'...' : null,
      sessionExpiry: st.sessionExpiry,
      legacyKeys: legacy,
      initializationComplete,
    };
  }, [scanLegacyTokens, initializationComplete]);

  const hydrateFromPersistedAuthStore = useCallback((): boolean => {
    return false;
  }, []);

  return {
    // State
    isAuthenticated,
    user,
    isLoading,
    error,
    initializationComplete, // nouvel indicateur

    // Token monitoring from tokenMonitor
    timeUntilExpiry: tokenMonitor.timeUntilExpiry,
    timeUntilRefresh: tokenMonitor.timeUntilRefresh,
    isRefreshing: tokenMonitor.isRefreshing,
    isTokenExpiringSoon: tokenMonitor.isTokenExpiringSoon,

    // Actions
    login,
    register,
    logout,
    refreshSession,
    clearError,

    // Helpers
    hasPermission,
    hasRole,
    getSessionTimeRemaining,

    // Enhanced features
    forceRefresh,
    isUserActive: tokenMonitor.isUserActive,
    activityLevel: tokenMonitor.activityLevel,

    // Diagnostic / recovery
    recoverFromStoredToken,
    scanLegacyTokens,
    attemptHydrateFromAnyStorage,
    debugDumpAuth,
    hydrateFromPersistedAuthStore,
  };
};

// Backward compatibility - keep the same interface as the original useAuth
export const useAuth = useEnhancedAuth;

export const __resetSharedAuthInitializationForTests = () => {
  resetSharedAuthInitialization();
};

// Specialized hooks for different use cases
export const useAuthUser = () => {
  const { user } = useEnhancedAuth();
  return user;
};

export const useIsAuthenticated = () => {
  const { isAuthenticated } = useEnhancedAuth();
  return isAuthenticated;
};

export const useAuthError = () => {
  const { error, clearError } = useEnhancedAuth();
  return { error, clearError };
};

export const useAuthLoading = () => {
  const { isLoading } = useEnhancedAuth();
  return isLoading;
};

// Session monitoring hook
export const useSessionStatus = () => {
  const {
    timeUntilExpiry,
    timeUntilRefresh,
    isRefreshing,
    isTokenExpiringSoon,
    isUserActive,
    activityLevel
  } = useEnhancedAuth();

  return {
    timeUntilExpiry,
    timeUntilRefresh,
    isRefreshing,
    isTokenExpiringSoon,
    isUserActive,
    activityLevel,
    formattedTimeUntilExpiry: formatTime(timeUntilExpiry),
    formattedTimeUntilRefresh: formatTime(timeUntilRefresh),
  };
};

// Utility function to format time
function formatTime(ms: number): string {
  if (ms <= 0) return '0s';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export const __resetSharedAuthInitializationForTests = () => {
  resetSharedAuthInitialization();
};

export default useEnhancedAuth;

