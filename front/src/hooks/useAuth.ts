/**
 * useAuth Hook - TypeScript version
 * Optimized authentication hook with comprehensive error handling
 */

import { useState, useEffect, useCallback } from 'react';
import authService, { AuthError } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import type { User, LoginForm, RegisterForm } from '../types';

export interface UseAuthReturn {
  // State
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;

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
}

export interface UseAuthOptions {
  autoRefresh?: boolean;
  redirectOnExpiry?: boolean;
  onAuthChange?: (isAuthenticated: boolean) => void;
  onError?: (error: AuthError) => void;
}

export const useAuth = (options: UseAuthOptions = {}): UseAuthReturn => {
  const {
    autoRefresh = true,
    redirectOnExpiry = false,
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
    refreshSession,
    checkSessionExpiry,
    hasPermission,
    hasRole,
  } = useAuthStore();

  // Initialize authentication state - Check if user is already authenticated
  useEffect(() => {
    const initAuth = async () => {

      // If already authenticated and not loading, we're done
      if (isAuthenticated && user && !isLoading) {
        return;
      }

      // Check if we're already loading to avoid duplicate initialization
      if (isLoading) {
        return;
      }

      setLoading(true);

      const token = authService.getCurrentToken();

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Validate token with API
        const validation = await authService.validateToken();

        if (!validation.user) {
          throw new AuthError('Données utilisateur manquantes dans la validation', 401);
        }

        storeLogin(validation.user, token);

      } catch (error) {
        console.error('🔐 useAuth - Error during validation:', error);
        if (error instanceof AuthError) {
          if (error.isUnauthorized()) {
            await storeLogout();
          } else {
            setError(error.getDisplayMessage());
            if (onError) onError(error);
          }
        }
        setLoading(false);
      }
    };

    // Initialize if we have no authentication data or if the store state is inconsistent
    const needsInit = !isAuthenticated || !user;

    if (needsInit) {
      initAuth();
    }
  }, []); // Empty dependency array to run only once

  // Session monitoring
  useEffect(() => {
    if (!isAuthenticated || !autoRefresh) return;

    const monitorSession = () => {
      // Check if session expired
      if (checkSessionExpiry()) {
        if (redirectOnExpiry) {
          window.location.href = '/login';
        }
        return;
      }

      // Auto-refresh session if needed (e.g., 5 minutes before expiry)
      const sessionTimeRemaining = getSessionTimeRemaining();
      if (sessionTimeRemaining > 0 && sessionTimeRemaining < 5 * 60 * 1000) {
        refreshSession().catch((error) => {
          if (onError && error instanceof AuthError) {
            onError(error);
          }
        });
      }
    };

    // Check session every minute
    const sessionInterval = setInterval(monitorSession, 60 * 1000);

    return () => clearInterval(sessionInterval);
  }, [isAuthenticated, autoRefresh, redirectOnExpiry, checkSessionExpiry, refreshSession, onError]);

  // Auth change callback
  useEffect(() => {
    if (onAuthChange) {
      onAuthChange(isAuthenticated);
    }
  }, [isAuthenticated, onAuthChange]);

  // Login function
  const login = useCallback(async (credentials: LoginForm): Promise<User> => {
    try {
      setLoading(true);
      storeClearError();

      const response /*: LoginResponse*/ = await authService.login(credentials) as any; // legacy shape { success, data }

      if (!response?.data?.token_auth || !response?.data?.uuid) {
        throw new AuthError('Réponse de connexion invalide', 500);
      }

      const user: User = {
        id: response.data.uuid,
        email: credentials.email,
        pseudo: credentials.email.split('@')[0],
        username: credentials.email.split('@')[0]
      };

      storeLogin(user, response.data.token_auth);
      return user;

    } catch (error) {
      const authError = error instanceof AuthError ? error : new AuthError('Erreur de connexion');
      setError(authError.getDisplayMessage());
      if (onError) onError(authError);
      throw authError;
    } finally {
      setLoading(false);
    }
  }, [storeLogin, setLoading, setError, storeClearError, onError]);

  // Register function
  const register = useCallback(async (credentials: RegisterForm): Promise<User> => {
    try {
      setLoading(true);
      storeClearError();

      const response /*: RegisterResponse*/ = await authService.register(credentials) as any;

      if (!response?.data?.token_auth || !response?.data?.uuid) {
        throw new AuthError('Réponse d\'inscription invalide', 500);
      }

      const user: User = {
        id: response.data.uuid,
        email: credentials.email,
        pseudo: credentials.pseudo || credentials.email.split('@')[0],
        username: credentials.pseudo || credentials.email.split('@')[0]
      };

      storeLogin(user, response.data.token_auth);
      return user;

    } catch (error) {
      const authError = error instanceof AuthError ? error : new AuthError('Erreur d\'inscription');
      setError(authError.getDisplayMessage());
      if (onError) onError(authError);
      throw authError;
    } finally {
      setLoading(false);
    }
  }, [storeLogin, setLoading, setError, storeClearError, onError]);

  // Logout function
  const logout = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      await authService.logout();
    } catch (error) {
      // Log error but don't throw - logout should always succeed locally
      console.warn('Logout error:', error);
    } finally {
      storeLogout();
      setLoading(false);
    }
  }, [storeLogout, setLoading]);

  // Clear error function
  const clearError = useCallback(() => {
    storeClearError();
  }, [storeClearError]);

  // Get session time remaining
  const getSessionTimeRemaining = useCallback((): number => {
    const store = useAuthStore.getState();
    if (!store.sessionExpiry) return 0;
    return Math.max(0, store.sessionExpiry - Date.now());
  }, []);

  return {
    // State
    isAuthenticated,
    user,
    isLoading,
    error,

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
  };
};

// Specialized hooks for common use cases
export const useAuthUser = () => {
  const { user } = useAuth();
  return user;
};

export const useIsAuthenticated = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
};

export const useAuthError = () => {
  const { error, clearError } = useAuth();
  return { error, clearError };
};

export const useAuthLoading = () => {
  const { isLoading } = useAuth();
  return isLoading;
};

// Permission hook
export const usePermissions = (requiredPermissions: string[] = []) => {
  const { hasPermission, isAuthenticated } = useAuth();

  const checkPermissions = useCallback((permissions: string[] = requiredPermissions) => {
    if (!isAuthenticated) return false;
    return permissions.every(permission => hasPermission(permission));
  }, [hasPermission, isAuthenticated, requiredPermissions]);

  const hasAllPermissions = checkPermissions();
  const hasAnyPermission = useCallback((permissions: string[]) => {
    if (!isAuthenticated) return false;
    return permissions.some(permission => hasPermission(permission));
  }, [hasPermission, isAuthenticated]);

  return {
    hasAllPermissions,
    hasAnyPermission,
    checkPermissions,
  };
};

// Role hook
export const useRoles = (requiredRoles: string[] = []) => {
  const { hasRole, isAuthenticated } = useAuth();

  const checkRoles = useCallback((roles: string[] = requiredRoles) => {
    if (!isAuthenticated) return false;
    return roles.every(role => hasRole(role));
  }, [hasRole, isAuthenticated, requiredRoles]);

  const hasAllRoles = checkRoles();
  const hasAnyRole = useCallback((roles: string[]) => {
    if (!isAuthenticated) return false;
    return roles.some(role => hasRole(role));
  }, [hasRole, isAuthenticated]);

  return {
    hasAllRoles,
    hasAnyRole,
    checkRoles,
  };
};

// Session monitoring hook
export const useSessionMonitor = () => {
  const { getSessionTimeRemaining, refreshSession } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    const updateTime = () => {
      setTimeRemaining(getSessionTimeRemaining());
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [getSessionTimeRemaining]);

  const formatTimeRemaining = useCallback((ms: number): string => {
    if (ms <= 0) return '0s';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }, []);

  return {
    timeRemaining,
    formattedTimeRemaining: formatTimeRemaining(timeRemaining),
    refreshSession,
    isExpiringSoon: timeRemaining > 0 && timeRemaining < 5 * 60 * 1000, // 5 minutes
  };
};
