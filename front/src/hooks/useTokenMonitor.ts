/**
 * useTokenMonitor - Advanced Token Monitoring and Auto-Refresh Hook
 * Provides automatic token refresh, session monitoring, and user activity tracking
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import enhancedAuthService from '../services/authService.enhanced';

export interface TokenMonitorConfig {
  refreshThreshold: number; // Minutes before expiry to refresh token
  activityTimeout: number; // Minutes of inactivity before logout
  checkInterval: number; // Seconds between token checks
  enableActivityTracking: boolean;
  enableVisibilityTracking: boolean;
  enableOfflineDetection: boolean;
  debugMode: boolean;
}

export interface TokenMonitorState {
  timeUntilRefresh: number;
  timeUntilExpiry: number;
  isRefreshing: boolean;
  lastRefreshTime: number | null;
  activityLevel: 'active' | 'idle' | 'away';
  isOnline: boolean;
  refreshCount: number;
}

const DEFAULT_CONFIG: TokenMonitorConfig = {
  refreshThreshold: 5, // 5 minutes
  activityTimeout: 30, // 30 minutes
  checkInterval: 60, // 60 seconds
  enableActivityTracking: true,
  enableVisibilityTracking: true,
  enableOfflineDetection: true,
  debugMode: false,
};

export const useTokenMonitor = (config: Partial<TokenMonitorConfig> = {}) => {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Auth store state
  const { isAuthenticated, user, logout, setError } = useAuthStore();

  // Local state
  const [state, setState] = useState<TokenMonitorState>({
    timeUntilRefresh: 0,
    timeUntilExpiry: 0,
    isRefreshing: false,
    lastRefreshTime: null,
    activityLevel: 'active',
    isOnline: navigator.onLine,
    refreshCount: 0,
  });

  // Refs for tracking
  const lastActivityRef = useRef(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Log debug information
  const debug = useCallback((message: string, ...args: any[]) => {
    if (fullConfig.debugMode) {
      console.log(`[TokenMonitor] ${message}`, ...args);
    }
  }, [fullConfig.debugMode]);

  // Update activity level based on last activity
  const updateActivityLevel = useCallback(() => {
    const now = Date.now();
    const timeSinceActivity = now - lastActivityRef.current;
    const activityTimeoutMs = fullConfig.activityTimeout * 60 * 1000;

    let newLevel: 'active' | 'idle' | 'away' = 'active';

    if (timeSinceActivity > activityTimeoutMs) {
      newLevel = 'away';
    } else if (timeSinceActivity > 5 * 60 * 1000) { // 5 minutes idle
      newLevel = 'idle';
    }

    setState(prev => {
      if (prev.activityLevel !== newLevel) {
        debug(`Activity level changed: ${prev.activityLevel} → ${newLevel}`);
        return { ...prev, activityLevel: newLevel };
      }
      return prev;
    });

    // Auto-logout after inactivity timeout
    if (newLevel === 'away' && isAuthenticated) {
      debug('User away for too long, logging out');
      logout();
      setError('Session expirée en raison d\'inactivité');
    }
  }, [fullConfig.activityTimeout, isAuthenticated, logout, setError, debug]);

  // Track user activity
  const trackActivity = useCallback(() => {
    lastActivityRef.current = Date.now();

    setState(prev => {
      if (prev.activityLevel !== 'active') {
        debug('User activity detected, setting to active');
        return { ...prev, activityLevel: 'active' };
      }
      return prev;
    });

    // Reset activity timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    activityTimeoutRef.current = setTimeout(() => {
      updateActivityLevel();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }, [updateActivityLevel, debug]);

  // Refresh token with error handling and retry logic
  const refreshToken = useCallback(async () => {
    if (state.isRefreshing) {
      debug('Refresh already in progress, skipping');
      return;
    }

    setState(prev => ({ ...prev, isRefreshing: true }));
    debug('Starting token refresh');

    try {
      const success = await enhancedAuthService.forceRefresh();

      if (success) {
        debug('Token refresh successful');
        setState(prev => ({
          ...prev,
          isRefreshing: false,
          lastRefreshTime: Date.now(),
          refreshCount: prev.refreshCount + 1,
        }));
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      debug('Token refresh failed:', error);
      setState(prev => ({ ...prev, isRefreshing: false }));

      // If refresh fails, logout user
      logout();
      setError('Session expirée. Veuillez vous reconnecter.');
    }
  }, [state.isRefreshing, logout, setError, debug]);

  // Check token expiry and schedule refresh
  const checkTokenExpiry = useCallback(() => {
    if (!isAuthenticated) {
      setState(prev => ({
        ...prev,
        timeUntilRefresh: 0,
        timeUntilExpiry: 0,
      }));
      return;
    }

    const timeUntilExpiry = enhancedAuthService.getTimeUntilExpiry();
    const refreshThresholdMs = fullConfig.refreshThreshold * 60 * 1000;
    const timeUntilRefresh = Math.max(0, timeUntilExpiry - refreshThresholdMs);

    setState(prev => ({
      ...prev,
      timeUntilRefresh,
      timeUntilExpiry,
    }));

    debug(`Time until refresh: ${Math.round(timeUntilRefresh / 1000)}s, until expiry: ${Math.round(timeUntilExpiry / 1000)}s`);

    // Schedule refresh if needed
    if (timeUntilRefresh <= 0 && timeUntilExpiry > 0 && !state.isRefreshing) {
      debug('Token needs refresh, scheduling immediately');
      refreshToken();
    } else if (timeUntilRefresh > 0 && timeUntilRefresh < 5 * 60 * 1000) { // Less than 5 minutes
      // Schedule refresh
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        debug('Scheduled token refresh triggered');
        refreshToken();
      }, timeUntilRefresh);
    }
  }, [isAuthenticated, fullConfig.refreshThreshold, state.isRefreshing, refreshToken, debug]);

  // Main monitoring loop
  useEffect(() => {
    if (!isAuthenticated) {
      // Clear intervals when not authenticated
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = null;
      }
      return;
    }

    // Initial check
    checkTokenExpiry();

    // Set up monitoring interval
    intervalRef.current = setInterval(() => {
      checkTokenExpiry();
      updateActivityLevel();
    }, fullConfig.checkInterval * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [isAuthenticated, checkTokenExpiry, updateActivityLevel, fullConfig.checkInterval]);

  // Set up activity tracking
  useEffect(() => {
    if (!fullConfig.enableActivityTracking || !isAuthenticated) {
      return;
    }

    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    events.forEach(event => {
      document.addEventListener(event, trackActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, trackActivity);
      });
    };
  }, [fullConfig.enableActivityTracking, isAuthenticated, trackActivity]);

  // Set up visibility tracking
  useEffect(() => {
    if (!fullConfig.enableVisibilityTracking || !isAuthenticated) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        debug('Page hidden, user went away');
        setState(prev => ({ ...prev, activityLevel: 'away' }));
      } else {
        debug('Page visible, user back');
        trackActivity();
        // Check token immediately when user comes back
        checkTokenExpiry();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fullConfig.enableVisibilityTracking, isAuthenticated, trackActivity, checkTokenExpiry, debug]);

  // Set up online/offline detection
  useEffect(() => {
    if (!fullConfig.enableOfflineDetection) {
      return;
    }

    const handleOnline = () => {
      debug('Back online');
      setState(prev => ({ ...prev, isOnline: true }));
      if (isAuthenticated) {
        // Check token when coming back online
        checkTokenExpiry();
      }
    };

    const handleOffline = () => {
      debug('Gone offline');
      setState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fullConfig.enableOfflineDetection, isAuthenticated, checkTokenExpiry, debug]);

  // Public API
  const forceRefresh = useCallback(async () => {
    debug('Force refresh requested');
    await refreshToken();
  }, [refreshToken, debug]);

  const getTimeUntilExpiry = useCallback(() => {
    return enhancedAuthService.getTimeUntilExpiry();
  }, []);

  const getTimeUntilRefresh = useCallback(() => {
    return state.timeUntilRefresh;
  }, [state.timeUntilRefresh]);

  const formatTime = useCallback((ms: number): string => {
    if (ms <= 0) return '0s';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }, []);

  return {
    // State
    ...state,
    isAuthenticated,
    user,

    // Time utilities
    timeUntilExpiryFormatted: formatTime(state.timeUntilExpiry),
    timeUntilRefreshFormatted: formatTime(state.timeUntilRefresh),

    // Actions
    forceRefresh,
    trackActivity,
    getTimeUntilExpiry,
    getTimeUntilRefresh,

    // Status checks
    isTokenExpiringSoon: state.timeUntilExpiry > 0 && state.timeUntilExpiry < 10 * 60 * 1000, // 10 minutes
    needsRefresh: state.timeUntilRefresh <= 0 && state.timeUntilExpiry > 0,
    isUserActive: state.activityLevel === 'active',

    // Config
    config: fullConfig,
  };
};

// Hook for simple token monitoring without activity tracking
export const useSimpleTokenMonitor = () => {
  return useTokenMonitor({
    enableActivityTracking: false,
    enableVisibilityTracking: false,
    debugMode: false,
  });
};

// Hook for development/debugging
export const useDebugTokenMonitor = () => {
  return useTokenMonitor({
    debugMode: true,
    checkInterval: 10, // Check every 10 seconds
    refreshThreshold: 1, // Refresh 1 minute before expiry
  });
};

export default useTokenMonitor;