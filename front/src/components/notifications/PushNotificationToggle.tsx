/**
 * PushNotificationToggle Component
 *
 * Toggle switch for enabling/disabling push notifications.
 * Shows permission status and handles subscription management.
 */

import { memo } from 'react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import styles from './PushNotificationToggle.module.css';

interface PushNotificationToggleProps {
  className?: string;
  variant?: 'default' | 'profile';
  compact?: boolean;
}

export const PushNotificationToggle = memo(function PushNotificationToggle({
  className,
  variant = 'default',
  compact = false,
}: PushNotificationToggleProps) {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    toggle,
  } = usePushNotifications();

  // Not supported - don't render
  if (!isSupported) {
    return null;
  }

  // Permission denied - show blocked message
  if (permission === 'denied') {
    if (compact) {
      return null;
    }
    return (
      <div className={`${styles.container} ${variant === 'profile' ? styles.profileVariant : ''} ${className ?? ''}`}>
        <div className={styles.content}>
          <div className={styles.iconWrapper}>
            <svg className={styles.iconBlocked} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v4" />
              <line x1="4" y1="4" x2="20" y2="20" />
            </svg>
          </div>
          <div className={styles.info}>
            <span className={styles.label}>Notifications push</span>
            <span className={styles.status}>Bloquées par le navigateur</span>
          </div>
        </div>
        <span className={styles.helpText}>
          Activez les notifications dans les paramètres de votre navigateur
        </span>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''} ${variant === 'profile' ? styles.profileVariant : ''} ${className ?? ''}`}>
      <div className={styles.content}>
        {!compact && (
          <div className={styles.iconWrapper}>
            <svg
              className={`${styles.icon} ${isSubscribed ? styles.iconActive : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {isSubscribed && (
              <span className={styles.activeDot} aria-hidden="true" />
            )}
          </div>
        )}
        {!compact && (
          <div className={styles.info}>
            <span className={styles.label}>Notifications push</span>
            <span className={`${styles.status} ${isSubscribed ? styles.statusActive : ''}`}>
              {isLoading
                ? 'Chargement...'
                : isSubscribed
                ? 'Activées'
                : ''}
            </span>
          </div>
        )}
        <button
          className={`${styles.toggle} ${isSubscribed ? styles.toggleActive : ''}`}
          onClick={toggle}
          disabled={isLoading}
          aria-label={isSubscribed ? 'Désactiver les notifications push' : 'Activer les notifications push'}
          aria-pressed={isSubscribed}
        >
          <span className={styles.toggleTrack}>
            <span className={styles.toggleThumb} />
          </span>
        </button>
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
});

export default PushNotificationToggle;
