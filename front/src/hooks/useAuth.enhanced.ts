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
    login: storeLogin,
    logout: storeLogout,
    setLoading,
    setError,
    clearError: storeClearError,
    hasPermission,
    hasRole,
  } = useAuthStore();

  // Token monitoring
  const tokenMonitor = useTokenMonitor({
    enableActivityTracking: activityTracking,
    debugMode,
    refreshThreshold: 5, // 5 minutes before expiry
    activityTimeout: 30, // 30 minutes of inactivity
  });

  // Local state for additional features
  const [initializationComplete, setInitializationComplete] = useState(false);

  // Global flag to prevent multiple initializations across instances
  const [isGloballyInitialized] = useState(() => {
    return (window as any).__AUTH_INITIALIZED__ || false;
  });

  // Initialize authentication state on mount
  useEffect(() => {
    const initAuth = async () => {
      if (initializationComplete || (window as any).__AUTH_INITIALIZED__) {
        if (!initializationComplete) {
          setInitializationComplete(true);
          setLoading(false);
        }
        return;
      }
      (window as any).__AUTH_INITIALIZED__ = true;
      setLoading(true);
      try {
        const hasToken = enhancedAuthService.isAuthenticated();
        if (!hasToken) {
          const hydrated = hydrateFromPersistedAuthStore();
          if (hydrated) {
            setLoading(false);
            setInitializationComplete(true);
            return;
          }
          const authStore = useAuthStore.getState();
          if (authStore.isAuthenticated) {
            authStore.logout();
          }
          setLoading(false);
          setInitializationComplete(true);
          return;
        }
        const timeUntilExpiry = enhancedAuthService.getTimeUntilExpiry();
        if (timeUntilExpiry <= 0) {
          const refreshed = await enhancedAuthService.forceRefresh();
          if (!refreshed) {
            await enhancedAuthService.logout();
            setLoading(false);
            setInitializationComplete(true);
            return;
          }
        }
        const currentToken = enhancedAuthService.getCurrentToken();
        if (currentToken) {
          try {
            const tokenPayload = JSON.parse(atob(currentToken.split('.')[1]));
            const user = {
              id: tokenPayload.id || tokenPayload.user_id,
              email: tokenPayload.sub || tokenPayload.email,
              username: tokenPayload.username || tokenPayload.pseudo,
              pseudo: tokenPayload.pseudo
            };
            storeLogin(user, currentToken);
          } catch {}
        }
      } catch (error) {
        if (error instanceof AuthError && error.isUnauthorized()) {
          await enhancedAuthService.logout();
        } else {
          setError(error instanceof AuthError ? error.message : 'Erreur d\'initialisation');
          if (onError && error instanceof AuthError) {
            onError(error);
          }
        }
      } finally {
        setLoading(false);
        setInitializationComplete(true);
      }
    };
    initAuth();
  }, [initializationComplete, storeLogin, setLoading, setError, onError]);

  // Auth change callback
  useEffect(() => {
    if (onAuthChange) {
      onAuthChange(isAuthenticated);
    }
  }, [isAuthenticated, onAuthChange]);

  // Effet de diagnostic: log à chaque changement d'état principal
  useEffect(() => {
    if (debugMode) {
      console.log('[AuthDebug] State changed:', {
        isAuthenticated,
        hasUser: !!user,
        userId: user?.id,
        isLoading,
        initializationComplete,
        token: enhancedAuthService.getCurrentToken()?.slice(0, 20) + '...'
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
        storeLogin(loggedInUser, token);
      } else {
        const currentToken = enhancedAuthService.getCurrentToken();
        if (currentToken) {
          storeLogin(loggedInUser, currentToken);
        }
      }
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
  }, [storeLogin, setLoading, setError, storeClearError, onError]);

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
      console.log('🔄 Enhanced Auth - Refreshing session...');
      await enhancedAuthService.forceRefresh();
      console.log('✅ Enhanced Auth - Session refreshed');
    } catch (error) {
      console.error('❌ Enhanced Auth - Session refresh failed:', error);

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
      console.error('❌ Enhanced Auth - Force refresh failed:', error);
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
    const currentToken = enhancedAuthService.getCurrentToken();
    if (!currentToken) return false;
    try {
      const payload = JSON.parse(atob(currentToken.split('.')[1]));
      const recoveredUser: User = {
        id: payload.id || payload.user_id,
        email: payload.sub || payload.email,
        username: payload.username || payload.pseudo,
        pseudo: payload.pseudo || payload.username || (payload.sub || '').split('@')[0]
      };
      if (debugMode) console.log('[AuthDebug] recoverFromStoredToken: Hydrating user from token payload', recoveredUser);
      storeLogin(recoveredUser, currentToken);
      setInitializationComplete(true);
      setLoading(false);
      return true;
    } catch (e) {
      console.warn('[AuthDebug] recoverFromStoredToken: Failed to decode token', e);
      return false;
    }
  }, [storeLogin, debugMode, setLoading]);

  const scanLegacyTokens = useCallback((): string[] => {
    const keys = [
      'authToken', 'auth_access_token', 'auth_token', 'token',
      'refresh_token', 'auth_refresh_token', 'auth_store', 'auth-store',
      'user_data', 'token_expiry'
    ];
    const found: string[] = [];
    for (const k of keys) {
      try {
        const v = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (v) found.push(`${k}:${String(v).slice(0,25)}...`);
      } catch {}
    }
    if (debugMode) console.log('[AuthDebug] scanLegacyTokens found', found);
    return found;
  }, [debugMode]);

  const attemptHydrateFromAnyStorage = useCallback((): boolean => {
    // Priorité: token JWT dans localStorage sous diverses clés
    const candidateKeys = ['auth_access_token','auth_token','authToken','token'];
    for (const key of candidateKeys) {
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (raw && raw.split('.').length === 3) {
        try {
          const payload = JSON.parse(atob(raw.split('.')[1]));
          const recoveredUser: User = {
            id: payload.id || payload.user_id,
            email: payload.sub || payload.email,
            username: payload.username || payload.pseudo,
            pseudo: payload.pseudo || payload.username || (payload.sub || '').split('@')[0]
          };
          if (debugMode) console.log('[AuthDebug] attemptHydrateFromAnyStorage success via key', key, recoveredUser);
          storeLogin(recoveredUser, raw);
          setInitializationComplete(true);
          setLoading(false);
          return true;
        } catch (e) {
          if (debugMode) console.warn('[AuthDebug] attemptHydrateFromAnyStorage decode fail', key, e);
        }
      }
    }
    return false;
  }, [storeLogin, debugMode, setLoading]);

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
    try {
      const raw = localStorage.getItem('auth-store');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const inner = parsed?.state;
      if (!inner) return false;
      const persistedIsAuth = inner.isAuthenticated || inner.isAuthenticate; // gestion d’un éventuel typo
      const persistedToken = inner.token;
      const persistedUser = inner.user;
      if (debugMode) console.log('[AuthDebug] hydrateFromPersistedAuthStore raw snapshot', inner);
      if (persistedIsAuth && persistedToken && persistedUser) {
        // Validation minimale du token (structure JWT possible)
        if (typeof persistedToken === 'string' && persistedToken.split('.').length === 3) {
          storeLogin(persistedUser as User, persistedToken);
          setInitializationComplete(true);
          setLoading(false);
          if (debugMode) console.log('[AuthDebug] hydrateFromPersistedAuthStore success (JWT token)');
          return true;
        }
        // Accepter token non JWT (fallback) mais loguer
        storeLogin(persistedUser as User, persistedToken as string);
        setInitializationComplete(true);
        setLoading(false);
        if (debugMode) console.log('[AuthDebug] hydrateFromPersistedAuthStore success (non-JWT token)');
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[AuthDebug] hydrateFromPersistedAuthStore failed', e);
      return false;
    }
  }, [storeLogin, debugMode, setLoading]);

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

export default useEnhancedAuth;

