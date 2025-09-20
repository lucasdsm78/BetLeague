/**
 * Auth Store - Zustand store for authentication state
 * Optimized for performance and security
 */

import React from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { User, AuthState, SecurityContext } from '../types';

interface AuthActions {
  // Auth actions
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  setError: (error: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  clearError: () => void;

  // Security actions
  updateSecurityContext: (context: Partial<SecurityContext>) => void;
  refreshSession: () => Promise<void>;
  checkSessionExpiry: () => boolean;

  // Getters
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

interface AuthStore extends AuthState {
  securityContext: SecurityContext | null;
  sessionExpiry: number | null;
}

type AuthStoreWithActions = AuthStore & AuthActions;

// Security configuration
const SECURITY_CONFIG = {
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  INACTIVITY_TIMEOUT: 30 * 60 * 1000,   // 30 minutes
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000,     // 15 minutes
};

// Secure storage with encryption (simplified for demo)
const secureStorage = {
  getItem: (name: string): string | null => {
    const item = localStorage.getItem(name);
    if (!item) return null;

    try {
      // In production, decrypt here
      return item;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      // In production, encrypt here
      localStorage.setItem(name, value);
    } catch {
      // Handle storage errors
    }
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  }
};

// Initial state
const initialState: AuthStore = {
  isAuthenticated: false,
  user: null,
  token: null,
  isLoading: false,
  error: null,
  securityContext: null,
  sessionExpiry: null,
};

// Create auth store with middleware
export const useAuthStore = create<AuthStoreWithActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // Auth actions
      login: (user: User, token: string) => {
        set((state) => {
          const now = Date.now();
          const expiry = now + SECURITY_CONFIG.SESSION_TIMEOUT;

          state.isAuthenticated = true;
          state.user = user;
          state.token = token;
          state.error = null;
          state.isLoading = false;
          state.sessionExpiry = expiry;

          // Initialize security context
          state.securityContext = {
            permissions: ['user:read', 'league:read', 'bet:create'] as string[],
            roles: ['user'] as string[],
            sessionId: crypto.randomUUID(),
            lastActivity: new Date().toISOString(),
            deviceFingerprint: navigator.userAgent,
          };
        });
      },

      logout: () => {
        set((state) => {
          // Clear all auth data
          state.isAuthenticated = false;
          state.user = null;
          state.token = null;
          state.error = null;
          state.isLoading = false;
          state.securityContext = null;
          state.sessionExpiry = null;
        });

        // Clear token from secure storage
        secureStorage.removeItem('auth-token');
      },

      updateUser: (updates: Partial<User>) => {
        set((state) => {
          if (state.user) {
            state.user = { ...state.user, ...updates };
          }
        });
      },

      setError: (error: string | null) => {
        set((state) => {
          state.error = error;
          state.isLoading = false;
        });
      },

      setLoading: (isLoading: boolean) => {
        set((state) => {
          state.isLoading = isLoading;
          if (isLoading) {
            state.error = null;
          }
        });
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },

      // Security actions
      updateSecurityContext: (context: Partial<SecurityContext>) => {
        set((state) => {
          if (state.securityContext) {
            state.securityContext = {
              ...state.securityContext,
              ...context,
              lastActivity: new Date().toISOString(),
              permissions: [...(context.permissions || state.securityContext.permissions)],
              roles: [...(context.roles || state.securityContext.roles)],
            };
          }
        });
      },

      refreshSession: async () => {
        const state = get();
        if (!state.isAuthenticated || !state.token) return;

        try {
          // Call refresh endpoint
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              'X-Authentication': `Bearer ${state.token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.token) {
              set((state) => {
                state.token = data.token;
                state.sessionExpiry = Date.now() + SECURITY_CONFIG.SESSION_TIMEOUT;
              });
            }
          } else {
            throw new Error('Session refresh failed');
          }
        } catch (error) {
          console.warn('Session refresh failed:', error);
          get().logout();
        }
      },

      checkSessionExpiry: () => {
        const state = get();
        if (!state.sessionExpiry) return false;

        const now = Date.now();
        const isExpired = now > state.sessionExpiry;

        if (isExpired) {
          get().logout();
          return true;
        }

        // Check for inactivity
        const lastActivity = state.securityContext?.lastActivity;
        if (lastActivity) {
          const lastActivityTime = new Date(lastActivity).getTime();
          const isInactive = now - lastActivityTime > SECURITY_CONFIG.INACTIVITY_TIMEOUT;

          if (isInactive) {
            get().logout();
            return true;
          }
        }

        return false;
      },

      // Getters
      hasPermission: (permission: string) => {
        const state = get();
        return state.securityContext?.permissions.includes(permission) ?? false;
      },

      hasRole: (role: string) => {
        const state = get();
        return state.securityContext?.roles.includes(role) ?? false;
      },
    })),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        // Only persist essential data
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
        sessionExpiry: state.sessionExpiry,
        securityContext: state.securityContext ? {
          permissions: state.securityContext.permissions,
          roles: state.securityContext.roles,
          sessionId: state.securityContext.sessionId,
        } : null,
      }),
      onRehydrateStorage: () => (state) => {
        // Check if session is expired on hydration
        if (state && state.checkSessionExpiry()) {
          console.info('Session expired, logging out');
        }
      },
    }
  )
);

// Session management hooks
export const useSessionManager = () => {
  const { checkSessionExpiry, refreshSession, updateSecurityContext } = useAuthStore();

  React.useEffect(() => {
    // Check session expiry every minute
    const interval = setInterval(() => {
      checkSessionExpiry();
    }, 60 * 1000);

    // Track user activity
    const trackActivity = () => {
      updateSecurityContext({
        lastActivity: new Date().toISOString(),
      });
    };

    // Activity event listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, trackActivity, { passive: true });
    });

    // Auto-refresh session when it's close to expiry
    const refreshInterval = setInterval(() => {
      const state = useAuthStore.getState();
      if (state.sessionExpiry) {
        const timeUntilExpiry = state.sessionExpiry - Date.now();
        // Refresh 5 minutes before expiry
        if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
          refreshSession();
        }
      }
    }, 60 * 1000);

    return () => {
      clearInterval(interval);
      clearInterval(refreshInterval);
      events.forEach(event => {
        document.removeEventListener(event, trackActivity);
      });
    };
  }, [checkSessionExpiry, refreshSession, updateSecurityContext]);
};

// Auth selectors for performance optimization
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useAuthToken = () => useAuthStore((state) => state.token);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);

// Security selectors
export const useHasPermission = (permission: string) =>
  useAuthStore((state) => state.hasPermission(permission));

export const useHasRole = (role: string) =>
  useAuthStore((state) => state.hasRole(role));

export const useSecurityContext = () =>
  useAuthStore((state) => state.securityContext);

export default useAuthStore;
