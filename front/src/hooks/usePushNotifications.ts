/**
 * usePushNotifications Hook
 *
 * React hook for managing push notification subscriptions.
 * Provides state and actions for enabling/disabling push notifications.
 */

import { useState, useEffect, useCallback } from 'react';
import pushNotificationService, {
  isPushSupported,
  getPermissionStatus,
} from '../services/push/pushNotificationService';

export interface PushNotificationState {
  /** Whether push notifications are supported by the browser */
  isSupported: boolean;
  /** Current notification permission status */
  permission: NotificationPermission;
  /** Whether the user is subscribed to push notifications */
  isSubscribed: boolean;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

export interface PushNotificationActions {
  /** Subscribe to push notifications */
  subscribe: () => Promise<boolean>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<boolean>;
  /** Toggle subscription state */
  toggle: () => Promise<boolean>;
  /** Refresh subscription status */
  refresh: () => Promise<void>;
}

export type UsePushNotificationsReturn = PushNotificationState & PushNotificationActions;

/**
 * Hook for managing push notifications
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported] = useState(() => isPushSupported());
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    getPermissionStatus()
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh subscription status
  const refresh = useCallback(async () => {
    if (!isSupported) return;

    try {
      setIsLoading(true);
      setError(null);

      // Check local subscription
      const localSub = await pushNotificationService.getLocalSubscription();
      const hasLocalSub = localSub !== null;

      // Check server status
      const serverStatus = await pushNotificationService.getPushStatus();
      const hasServerSub = serverStatus?.subscribed ?? false;

      // User is subscribed if both local and server agree
      setIsSubscribed(hasLocalSub && hasServerSub);

      // Update permission
      setPermission(getPermissionStatus());
    } catch (err) {
      console.error('[usePushNotifications] Refresh error:', err);
      setError('Erreur lors de la vérification du statut');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  // Initialize on mount
  useEffect(() => {
    if (isSupported) {
      void pushNotificationService.initPushService();
      void refresh();
    }
  }, [isSupported, refresh]);

  // Listen for permission changes
  useEffect(() => {
    if (!isSupported) return;

    const handlePermissionChange = () => {
      setPermission(getPermissionStatus());
    };

    // Some browsers support onchange
    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'notifications' })
        .then((permissionStatus) => {
          permissionStatus.onchange = handlePermissionChange;
        })
        .catch(() => {
          // Ignore - not all browsers support this
        });
    }
  }, [isSupported]);

  // Subscribe action
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Les notifications push ne sont pas supportées');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      const success = await pushNotificationService.subscribeToPush();

      if (success) {
        setIsSubscribed(true);
        setPermission(getPermissionStatus());
        return true;
      } else {
        const perm = getPermissionStatus();
        setPermission(perm);

        if (perm === 'denied') {
          setError('Les notifications sont bloquées. Vérifiez les paramètres de votre navigateur.');
        } else {
          setError("Échec de l'inscription aux notifications");
        }
        return false;
      }
    } catch (err) {
      console.error('[usePushNotifications] Subscribe error:', err);
      setError("Erreur lors de l'inscription aux notifications");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  // Unsubscribe action
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const success = await pushNotificationService.unsubscribeFromPush();

      if (success) {
        setIsSubscribed(false);
        return true;
      } else {
        setError('Échec de la désinscription aux notifications');
        return false;
      }
    } catch (err) {
      console.error('[usePushNotifications] Unsubscribe error:', err);
      setError('Erreur lors de la désinscription aux notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Toggle action
  const toggle = useCallback(async (): Promise<boolean> => {
    if (isSubscribed) {
      return unsubscribe();
    } else {
      return subscribe();
    }
  }, [isSubscribed, subscribe, unsubscribe]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    toggle,
    refresh,
  };
}

export default usePushNotifications;