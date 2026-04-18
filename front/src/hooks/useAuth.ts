/**
 * useAuth Hook - TypeScript version
 * Réécrit pour déléguer au hook sécurisé useEnhancedAuth
 */

import { useEffect, useCallback, useState } from 'react';
import { useEnhancedAuth } from './useAuth.enhanced';
import { AuthError } from '../services/authService.enhanced';
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

  const auth = useEnhancedAuth({
    autoRefresh,
    onAuthChange,
    onError,
  });

  // Redirection en cas d'expiration de session
  useEffect(() => {
    if (!redirectOnExpiry) return;
    if (auth.isLoading) return;
    if (auth.initializationComplete === false) return;
    if (!auth.isAuthenticated) {
      window.location.href = '/login';
    }
  }, [redirectOnExpiry, auth.isAuthenticated, auth.isLoading, auth.initializationComplete]);

  return {
    // State
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    isLoading: auth.isLoading,
    error: auth.error,

    // Actions
    login: auth.login,
    register: auth.register,
    logout: auth.logout,
    refreshSession: auth.refreshSession,
    clearError: auth.clearError,

    // Helpers
    hasPermission: auth.hasPermission,
    hasRole: auth.hasRole,
    getSessionTimeRemaining: auth.getSessionTimeRemaining,
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
