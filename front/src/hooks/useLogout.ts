/**
 * Advanced Logout Hook - Secure logout management for React TypeScript
 * Mobile-first, high-performance logout functionality with device management
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnhancedAuth } from './useAuth.enhanced';
import { useToast } from './useToast';
import secureApiClient from '../services/secureApiClient';

export type LogoutOption = 'current' | 'all_devices' | 'except_current';
export type LogoutTrigger = 'manual' | 'inactivity' | 'security' | 'session_expired';

export interface LogoutProgress {
  stage: 'idle' | 'client_cleanup' | 'server_request' | 'auth_cleanup' | 'navigation' | 'complete';
  percentage: number;
  message: string;
}

export interface UseLogoutOptions {
  enableAnalytics?: boolean;
  autoNavigate?: boolean;
  fallbackUrl?: string;
  onLogoutStart?: (option: LogoutOption, trigger: LogoutTrigger) => void;
  onLogoutComplete?: (option: LogoutOption, trigger: LogoutTrigger) => void;
  onLogoutError?: (error: Error, option: LogoutOption, trigger: LogoutTrigger) => void;
}

export interface UseLogoutReturn {
  // State
  isLoggingOut: boolean;
  progress: LogoutProgress;
  lastLogoutError: string | null;

  // Actions
  logout: (option?: LogoutOption, trigger?: LogoutTrigger, force?: boolean) => Promise<boolean>;
  quickLogout: () => Promise<boolean>;
  emergencyLogout: () => Promise<boolean>;
  clearError: () => void;

  // Utilities
  canLogout: boolean;
  getLogoutOptionLabel: (option: LogoutOption) => string;
  getLogoutOptionDescription: (option: LogoutOption) => string;
  estimateLogoutTime: (option: LogoutOption) => number;
}

// Logout option configurations
const LOGOUT_OPTIONS = {
  current: {
    label: 'Cet appareil uniquement',
    description: 'Déconnexion de cet appareil seulement',
    endpoint: '/auth/logout',
    estimatedTime: 2000, // 2 seconds
    securityLevel: 'low' as const,
  },
  all_devices: {
    label: 'Tous les appareils',
    description: 'Déconnexion de tous vos appareils connectés',
    endpoint: '/auth/logout-all',
    estimatedTime: 5000, // 5 seconds
    securityLevel: 'high' as const,
  },
  except_current: {
    label: 'Autres appareils',
    description: 'Garder cette session, déconnecter les autres',
    endpoint: '/auth/logout-others',
    estimatedTime: 3000, // 3 seconds
    securityLevel: 'medium' as const,
  },
} as const;

export const useLogout = (options: UseLogoutOptions = {}): UseLogoutReturn => {
  const {
    enableAnalytics = true,
    autoNavigate = true,
    fallbackUrl = '/',
    onLogoutStart,
    onLogoutComplete,
    onLogoutError,
  } = options;

  // Dependencies
  const navigate = useNavigate();
  const { logout: authLogout, isAuthenticated } = useEnhancedAuth();
  const { showSuccess, showError } = useToast();

  // State
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [progress, setProgress] = useState<LogoutProgress>({
    stage: 'idle',
    percentage: 0,
    message: 'Prêt à se déconnecter',
  });
  const [lastLogoutError, setLastLogoutError] = useState<string | null>(null);

  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Progress stages configuration
  const PROGRESS_STAGES = {
    idle: { percentage: 0, message: 'Prêt à se déconnecter' },
    client_cleanup: { percentage: 20, message: 'Nettoyage des données locales...' },
    server_request: { percentage: 50, message: 'Déconnexion du serveur...' },
    auth_cleanup: { percentage: 80, message: 'Nettoyage de la session...' },
    navigation: { percentage: 95, message: 'Redirection...' },
    complete: { percentage: 100, message: 'Déconnexion terminée' },
  };

  // Update progress with stage
  const updateProgress = useCallback((stage: LogoutProgress['stage'], customMessage?: string) => {
    const stageConfig = PROGRESS_STAGES[stage];
    setProgress({
      stage,
      percentage: stageConfig.percentage,
      message: customMessage || stageConfig.message,
    });
  }, []);

  // Log analytics event
  const logAnalyticsEvent = useCallback((
    event: string,
    option: LogoutOption,
    trigger: LogoutTrigger,
    data?: Record<string, any>
  ) => {
    if (!enableAnalytics) return;

    try {
      console.log(`🔐 Logout Analytics: ${event}`, {
        option,
        trigger,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        ...data,
      });

      // In a real app, you might send this to your analytics service
      // analytics.track(event, { option, trigger, ...data });
    } catch (error) {
      console.warn('📊 Analytics logging failed:', error);
    }
  }, [enableAnalytics]);

  // Clear any ongoing logout process
  const cleanupLogoutProcess = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Main logout function with comprehensive error handling
  const logout = useCallback(async (
    option: LogoutOption = 'current',
    trigger: LogoutTrigger = 'manual',
    force = false
  ): Promise<boolean> => {
    // Prevent concurrent logout operations
    if (isLoggingOut && !force) {
      console.warn('🔐 Logout already in progress, skipping...');
      return false;
    }

    // Validate option
    if (!(option in LOGOUT_OPTIONS)) {
      console.error('🔐 Invalid logout option:', option);
      setLastLogoutError('Option de déconnexion invalide');
      return false;
    }

    const optionConfig = LOGOUT_OPTIONS[option];
    console.log(`🔐 Starting logout process: ${option} (${trigger})`);

    // Setup abort controller for cancellation
    cleanupLogoutProcess();
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setIsLoggingOut(true);
    setLastLogoutError(null);
    updateProgress('client_cleanup');

    // Notify start
    try {
      onLogoutStart?.(option, trigger);
      logAnalyticsEvent('logout_started', option, trigger, {
        securityLevel: optionConfig.securityLevel,
        forced: force,
      });
    } catch (error) {
      console.warn('🔐 Logout start callback error:', error);
    }

    let success = false;

    try {
      // Stage 1: Client-side cleanup (20%)
      updateProgress('client_cleanup', 'Nettoyage des données locales...');

      // Clear sensitive client data immediately
      secureApiClient.clearCache();

      // Small delay to show progress (only for non-emergency logouts)
      if (trigger !== 'security') {
        await new Promise(resolve => {
          timeoutRef.current = setTimeout(resolve, 300);
        });
      }

      // Check if cancelled
      if (signal.aborted) {
        throw new Error('Logout cancelled');
      }

      // Stage 2: Server logout request (50%)
      updateProgress('server_request', `Déconnexion du serveur (${optionConfig.label.toLowerCase()})...`);

      try {
        const response = await secureApiClient.post(optionConfig.endpoint, {
          reason: trigger,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        }, {
          signal,
          timeout: trigger === 'security' ? 2000 : 5000, // Shorter timeout for security logouts
        });

        console.log(`✅ Server logout successful for ${option}:`, response.data?.message || 'Success');

        logAnalyticsEvent('server_logout_success', option, trigger, {
          responseTime: Date.now(),
          message: response.data?.message,
        });

      } catch (serverError: any) {
        // Server logout failed, but continue with client logout for security
        console.warn(`⚠️ Server logout failed for ${option}, continuing with client logout:`, serverError);

        logAnalyticsEvent('server_logout_failed', option, trigger, {
          error: serverError.message,
          code: serverError.code,
        });

        // Don't throw here - client logout should still proceed for security
      }

      // Check if cancelled
      if (signal.aborted) {
        throw new Error('Logout cancelled');
      }

      // Stage 3: Auth cleanup (80%)
      updateProgress('auth_cleanup', 'Nettoyage de la session...');

      // Always perform client-side logout (most important for security)
      await authLogout();

      // Stage 4: Navigation (95%)
      if (autoNavigate) {
        updateProgress('navigation', 'Redirection...');

        // Small delay for better UX
        await new Promise(resolve => {
          timeoutRef.current = setTimeout(resolve, 200);
        });

        // Force complete logout by reloading the page
        console.log('🔐 Forcing page reload to ensure clean logout');
        window.location.href = fallbackUrl;
      }

      // Stage 5: Complete (100%)
      updateProgress('complete');
      success = true;

      // Success notifications
      showSuccess(
        'Déconnexion réussie',
        optionConfig.label === 'Cet appareil uniquement'
          ? 'Vous avez été déconnecté de cet appareil'
          : `Déconnexion de ${optionConfig.label.toLowerCase()} réussie`
      );

      logAnalyticsEvent('logout_completed', option, trigger, {
        duration: Date.now(),
        success: true,
      });

      // Notify completion
      try {
        onLogoutComplete?.(option, trigger);
      } catch (error) {
        console.warn('🔐 Logout complete callback error:', error);
      }

    } catch (error: any) {
      console.error(`❌ Logout failed for ${option}:`, error);

      const errorMessage = error.message || `Erreur lors de la déconnexion (${optionConfig.label.toLowerCase()})`;
      setLastLogoutError(errorMessage);

      // Log error
      logAnalyticsEvent('logout_failed', option, trigger, {
        error: errorMessage,
        stage: progress.stage,
      });

      // Notify error
      try {
        onLogoutError?.(error, option, trigger);
      } catch (callbackError) {
        console.warn('🔐 Logout error callback error:', callbackError);
      }

      // Emergency fallback for security-critical scenarios
      if (trigger === 'security' || force) {
        console.warn('🔐 Attempting emergency logout fallback...');

        try {
          await authLogout();
          if (autoNavigate) {
            window.location.href = fallbackUrl;
          }
          success = true;
        } catch (fallbackError) {
          console.error('🔐 Emergency logout fallback failed:', fallbackError);
          showError('Erreur critique', 'Déconnexion d\'urgence requise. Veuillez fermer votre navigateur.');

          // Last resort: force page reload
          setTimeout(() => {
            window.location.href = fallbackUrl;
          }, 1000);
        }
      } else {
        showError('Erreur de déconnexion', errorMessage);
      }
    } finally {
      cleanupLogoutProcess();
      setIsLoggingOut(false);

      // Reset progress after a delay
      setTimeout(() => {
        updateProgress('idle');
      }, 1000);
    }

    return success;
  }, [
    isLoggingOut,
    authLogout,
    navigate,
    autoNavigate,
    fallbackUrl,
    onLogoutStart,
    onLogoutComplete,
    onLogoutError,
    updateProgress,
    showSuccess,
    showError,
    logAnalyticsEvent,
    cleanupLogoutProcess,
    progress.stage,
  ]);

  // Quick logout - current device only with minimal UI
  const quickLogout = useCallback(async (): Promise<boolean> => {
    return logout('current', 'manual', false);
  }, [logout]);

  // Emergency logout - immediate force logout with minimal delays
  const emergencyLogout = useCallback(async (): Promise<boolean> => {
    console.log('🚨 Emergency logout initiated');
    return logout('current', 'security', true);
  }, [logout]);

  // Clear last error
  const clearError = useCallback(() => {
    setLastLogoutError(null);
  }, []);

  // Utility functions
  const getLogoutOptionLabel = useCallback((option: LogoutOption): string => {
    return LOGOUT_OPTIONS[option]?.label || 'Option inconnue';
  }, []);

  const getLogoutOptionDescription = useCallback((option: LogoutOption): string => {
    return LOGOUT_OPTIONS[option]?.description || 'Description non disponible';
  }, []);

  const estimateLogoutTime = useCallback((option: LogoutOption): number => {
    return LOGOUT_OPTIONS[option]?.estimatedTime || 3000;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupLogoutProcess();
    };
  }, [cleanupLogoutProcess]);

  return {
    // State
    isLoggingOut,
    progress,
    lastLogoutError,

    // Actions
    logout,
    quickLogout,
    emergencyLogout,
    clearError,

    // Utilities
    canLogout: isAuthenticated && !isLoggingOut,
    getLogoutOptionLabel,
    getLogoutOptionDescription,
    estimateLogoutTime,
  };
};

// Specialized hooks for common use cases
export const useQuickLogout = () => {
  const { quickLogout, isLoggingOut } = useLogout({
    autoNavigate: true,
    enableAnalytics: true,
  });

  return { quickLogout, isLoggingOut };
};

export const useEmergencyLogout = () => {
  const { emergencyLogout, isLoggingOut } = useLogout({
    autoNavigate: true,
    enableAnalytics: true,
    fallbackUrl: '/?emergency=true',
  });

  return { emergencyLogout, isLoggingOut };
};

// Hook for logout with custom analytics
export const useLogoutWithAnalytics = (analyticsHandler: (event: string, data: any) => void) => {
  return useLogout({
    enableAnalytics: true,
    onLogoutStart: (option, trigger) => {
      analyticsHandler('logout_started', { option, trigger });
    },
    onLogoutComplete: (option, trigger) => {
      analyticsHandler('logout_completed', { option, trigger });
    },
    onLogoutError: (error, option, trigger) => {
      analyticsHandler('logout_failed', { error: error.message, option, trigger });
    },
  });
};

export default useLogout;