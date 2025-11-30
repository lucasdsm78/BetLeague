/**
 * AuthMonitor - Global Authentication Monitoring Component
 * Provides silent authentication management and user notifications
 */

import React, { memo, useEffect, useCallback, useState } from 'react';
import { useEnhancedAuth, useSessionStatus } from '../../hooks/useAuth.enhanced';
import './AuthMonitor.css';

export interface AuthMonitorProps {
  enableNotifications?: boolean;
  enableExpiryWarning?: boolean;
  expiryWarningThreshold?: number; // Minutes before expiry to show warning
  enableInactivityWarning?: boolean;
  inactivityWarningThreshold?: number; // Minutes of inactivity before warning
  children?: React.ReactNode;
}

interface NotificationState {
  show: boolean;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const AuthMonitor = memo<AuthMonitorProps>(({
  enableNotifications = true,
  enableExpiryWarning = true,
  expiryWarningThreshold = 10, // 10 minutes
  enableInactivityWarning = true,
  inactivityWarningThreshold = 25, // 25 minutes (5 min before 30 min timeout)
  children,
}) => {
  const {
    isAuthenticated,
    error,
    clearError,
    refreshSession,
    forceRefresh,
    activityLevel,
  } = useEnhancedAuth({
    autoRefresh: true,
    activityTracking: true,
    debugMode: true,
  });

  const {
    timeUntilExpiry,
    isRefreshing,
    isTokenExpiringSoon,
    formattedTimeUntilExpiry,
  } = useSessionStatus();

  const [notification, setNotification] = useState<NotificationState>({
    show: false,
    type: 'info',
    title: '',
    message: '',
  });

  const [hasShownExpiryWarning, setHasShownExpiryWarning] = useState(false);
  const [hasShownInactivityWarning, setHasShownInactivityWarning] = useState(false);

  // Show notification helper
  const showNotification = useCallback((
    type: NotificationState['type'],
    title: string,
    message: string,
    action?: NotificationState['action']
  ) => {
    if (!enableNotifications) return;

    setNotification({
      show: true,
      type,
      title,
      message,
      action,
    });
  }, [enableNotifications]);

  // Hide notification
  const hideNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, show: false }));
  }, []);

  // Handle token expiry warning
  useEffect(() => {
    if (!isAuthenticated || !enableExpiryWarning) return;

    const thresholdMs = expiryWarningThreshold * 60 * 1000;
    const shouldShowWarning = timeUntilExpiry > 0 && timeUntilExpiry <= thresholdMs;

    if (shouldShowWarning && !hasShownExpiryWarning && !isRefreshing) {
      setHasShownExpiryWarning(true);
      showNotification(
        'warning',
        'Session va expirer',
        `Votre session expire dans ${formattedTimeUntilExpiry}. Voulez-vous la prolonger ?`,
        {
          label: 'Prolonger',
          onClick: async () => {
            hideNotification();
            try {
              await forceRefresh();
              showNotification('info', 'Session prolongée', 'Votre session a été prolongée avec succès.');
            } catch {
              showNotification('error', 'Erreur', 'Impossible de prolonger la session. Veuillez vous reconnecter.');
            }
          },
        }
      );
    }

    // Reset warning flag when token is refreshed
    if (timeUntilExpiry > thresholdMs) {
      setHasShownExpiryWarning(false);
    }
  }, [
    isAuthenticated,
    enableExpiryWarning,
    timeUntilExpiry,
    expiryWarningThreshold,
    hasShownExpiryWarning,
    isRefreshing,
    formattedTimeUntilExpiry,
    showNotification,
    hideNotification,
    forceRefresh,
  ]);

  // Handle inactivity warning
  useEffect(() => {
    if (!isAuthenticated || !enableInactivityWarning) return;

    const shouldShowInactivityWarning = activityLevel === 'idle' && !hasShownInactivityWarning;

    if (shouldShowInactivityWarning) {
      setHasShownInactivityWarning(true);
      showNotification(
        'warning',
        'Inactivité détectée',
        `Vous êtes inactif depuis un moment. Votre session expirera automatiquement dans ${30 - inactivityWarningThreshold} minutes d'inactivité.`,
        {
          label: 'Rester connecté',
          onClick: () => {
            hideNotification();
            // Trigger activity to reset inactivity timer
            document.dispatchEvent(new Event('mousedown'));
          },
        }
      );
    }

    // Reset warning when user becomes active again
    if (activityLevel === 'active') {
      setHasShownInactivityWarning(false);
    }
  }, [
    isAuthenticated,
    enableInactivityWarning,
    activityLevel,
    hasShownInactivityWarning,
    inactivityWarningThreshold,
    showNotification,
    hideNotification,
  ]);

  // Handle authentication errors
  useEffect(() => {
    if (error) {
      showNotification(
        'error',
        'Erreur d\'authentification',
        error,
        {
          label: 'Fermer',
          onClick: () => {
            clearError();
            hideNotification();
          },
        }
      );
    }
  }, [error, showNotification, hideNotification, clearError]);

  // Auto-hide success notifications
  useEffect(() => {
    if (notification.show && notification.type === 'info') {
      const timer = setTimeout(() => {
        hideNotification();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notification.show, notification.type, hideNotification]);

  // Development mode: show session info
  const showSessionInfo = process.env.NODE_ENV === 'development' && isAuthenticated;

  return (
    <>
      {children}

      {/* Notification Toast */}
      {notification.show && (
        <div className={`auth-notification auth-notification--${notification.type}`}>
          <div className="auth-notification__content">
            <div className="auth-notification__header">
              <h4 className="auth-notification__title">{notification.title}</h4>
              <button
                className="auth-notification__close"
                onClick={hideNotification}
                aria-label="Fermer la notification"
              >
                ✕
              </button>
            </div>
            <p className="auth-notification__message">{notification.message}</p>
            {notification.action && (
              <div className="auth-notification__actions">
                <button
                  className="auth-notification__action"
                  onClick={notification.action.onClick}
                >
                  {notification.action.label}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Development Session Info */}
      {showSessionInfo && (
        <div className="auth-session-info">
          <div className="auth-session-info__content">
            <h5>Session Debug Info</h5>
            <div className="auth-session-info__stats">
              <div>Expire dans: {formattedTimeUntilExpiry}</div>
              <div>Activité: {activityLevel}</div>
              <div>Actualisation: {isRefreshing ? 'En cours...' : 'Prêt'}</div>
              <div>Status: {isTokenExpiringSoon ? 'Expire bientôt' : 'OK'}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

AuthMonitor.displayName = 'AuthMonitor';

export default AuthMonitor;
