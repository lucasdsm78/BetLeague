import React, { useMemo } from 'react';
import usePushNotifications from '../../hooks/usePushNotifications';
import styles from './PushNotificationToggle.module.css';

export function PushNotificationToggle() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    toggle,
  } = usePushNotifications();

  const iosHint = useMemo(() => {
    const ua = navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(ua);
    // @ts-ignore
    const isStandalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    return { isIos, isStandalone };
  }, []);

  const label = !isSupported
    ? 'Indisponible'
    : isSubscribed
      ? 'Activées'
      : 'Activer';

  const disabled = !isSupported || isLoading;

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={`${styles.button} ${isSubscribed ? styles.on : styles.off}`}
        onClick={() => void toggle()}
        disabled={disabled}
        aria-disabled={disabled}
      >
        <span className={styles.label}>{label}</span>
        <span className={styles.meta}>
          {permission === 'denied' ? 'Bloquées' : permission === 'granted' ? 'Autorisé' : 'À autoriser'}
        </span>
      </button>

      {!isSupported && iosHint.isIos && !iosHint.isStandalone ? (
        <div className={styles.helperText}>
          Pour activer les notifications sur iPhone/iPad, installe l’app : Safari → Partager →
          <strong> Ajouter à l’écran d’accueil</strong>.
        </div>
      ) : null}

      {permission === 'denied' ? (
        <div className={styles.helperText}>
          Les notifications sont bloquées. Ouvre les réglages du navigateur et autorise les notifications pour ce site.
        </div>
      ) : null}

      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  );
}

export default PushNotificationToggle;
