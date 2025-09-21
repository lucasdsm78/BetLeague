/**
 * Enhanced useAuth Hook - Secure authentication with automatic refresh
 * Replaces the original useAuth with enhanced security and token management
 */

import { useState, useEffect, useCallback } from 'react';
import enhancedAuthService, { AuthError } from '../services/authService.enhanced';
import { useAuthStore } from '../store/authStore';
import useTokenMonitor from './useTokenMonitor';
import type { User, LoginForm, RegisterForm } from '../types';

export interface UseAuthReturn {
  // State
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;

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
      // Check both local and global initialization
      if (initializationComplete || (window as any).__AUTH_INITIALIZED__) {
        console.log('🔐 Enhanced Auth - Already initialized globally, skipping...');
        if (!initializationComplete) {
          setInitializationComplete(true);
          setLoading(false);
        }
        return;
      }

      console.log('🔐 Enhanced Auth - Starting initialization...');
      (window as any).__AUTH_INITIALIZED__ = true;
      setLoading(true);

      try {
        // Check if we have a stored token
        const hasToken = enhancedAuthService.isAuthenticated();

        if (!hasToken) {
          console.log('🔐 Enhanced Auth - No token found, ensuring logout state');

          // Ensure we're in logged out state
          const authStore = useAuthStore.getState();
          if (authStore.isAuthenticated) {
            authStore.logout();
          }

          setLoading(false);
          setInitializationComplete(true);
          return;
        }

        console.log('🔐 Enhanced Auth - Token found, checking validity...');

        // Check if token is expired locally first (faster)
        const timeUntilExpiry = enhancedAuthService.getTimeUntilExpiry();
        if (timeUntilExpiry <= 0) {
          console.log('🔐 Enhanced Auth - Token expired locally, trying refresh...');

          const refreshed = await enhancedAuthService.forceRefresh();
          if (!refreshed) {
            console.log('🔐 Enhanced Auth - Token refresh failed, clearing session');
            await enhancedAuthService.logout();
            setLoading(false);
            setInitializationComplete(true);
            return;
          }
          console.log('🔐 Enhanced Auth - Token refreshed successfully');
        }

        // Get user from stored token (instead of server validation)
        const currentToken = enhancedAuthService.getCurrentToken();
        if (currentToken) {
          // Try to extract user from token payload (JWT decode)
          try {
            const tokenPayload = JSON.parse(atob(currentToken.split('.')[1]));
            const user = {
              id: tokenPayload.id || tokenPayload.user_id,
              email: tokenPayload.sub || tokenPayload.email,
              username: tokenPayload.username || tokenPayload.pseudo,
              pseudo: tokenPayload.pseudo
            };

            console.log('🔐 Enhanced Auth - User extracted from token:', user);
            storeLogin(user, currentToken);
          } catch (decodeError) {
            console.warn('🔐 Enhanced Auth - Could not decode token, will validate later:', decodeError);
            // Fall back to basic auth state without user data
            // The user data will be fetched when needed
          }
        }

      } catch (error) {
        console.error('🔐 Enhanced Auth - Initialization failed:', error);

        if (error instanceof AuthError && error.isUnauthorized()) {
          // Token is invalid, clear everything
          await enhancedAuthService.logout();
        } else {
          // Network or other error, show error message
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

  // Enhanced login function
  const login = useCallback(async (credentials: LoginForm): Promise<User> => {
    try {
      console.log('🔐 Enhanced Auth - Starting login process...');
      setLoading(true);
      storeClearError();

      const { user: loggedInUser } = await enhancedAuthService.login(credentials);

      console.log('✅ Enhanced Auth - Login successful:', loggedInUser);
      return loggedInUser;

    } catch (error) {
      console.error('❌ Enhanced Auth - Login failed:', error);

      const authError = error instanceof AuthError ? error : new AuthError('Erreur de connexion');
      setError(authError.message);

      if (onError) {
        onError(authError);
      }

      throw authError;
    } finally {
      setLoading(false);
    }
  }, [storeLogin, setLoading, setError, storeClearError, onError]);

  // Enhanced register function
  const register = useCallback(async (credentials: RegisterForm): Promise<User> => {
    try {
      console.log('🔐 Enhanced Auth - Starting registration process...');
      setLoading(true);
      storeClearError();

      const { user: registeredUser } = await enhancedAuthService.register(credentials);

      console.log('✅ Enhanced Auth - Registration successful:', registeredUser);
      return registeredUser;

    } catch (error) {
      console.error('❌ Enhanced Auth - Registration failed:', error);

      const authError = error instanceof AuthError ? error : new AuthError('Erreur d\'inscription');
      setError(authError.message);

      if (onError) {
        onError(authError);
      }

      throw authError;
    } finally {
      setLoading(false);
    }
  }, [storeLogin, setLoading, setError, storeClearError, onError]);

  // Enhanced logout function
  const logout = useCallback(async (): Promise<void> => {
    try {
      console.log('🔐 Enhanced Auth - Starting logout process...');
      setLoading(true);

      await enhancedAuthService.logout();

      console.log('✅ Enhanced Auth - Logout successful');
    } catch (error) {
      console.warn('⚠️ Enhanced Auth - Logout error (continuing anyway):', error);
    } finally {
      setLoading(false);
    }
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

  return {
    // State
    isAuthenticated,
    user,
    isLoading,
    error,

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