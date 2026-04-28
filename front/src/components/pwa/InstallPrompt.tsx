/**
 * PWA Install Prompt Component
 *
 * Shows a banner prompting users to install the app on their device.
 * Works on Android Chrome and iOS Safari.
 */

import { memo, useState, useEffect, useCallback } from 'react';
import styles from './InstallPrompt.module.css';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Check if running as standalone PWA
function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

// Check if iOS
function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// Check if already dismissed
function isDismissed(): boolean {
  try {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (!dismissed) return false;
    // Re-show after 7 days
    const dismissedAt = parseInt(dismissed, 10);
    return Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export const InstallPrompt = memo(function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed or dismissed
    if (isStandalone() || isDismissed()) return;

    // iOS: Show manual instructions
    if (isIos()) {
      setShowIosPrompt(true);
      setVisible(true);
      return;
    }

    // Android/Chrome: Listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setVisible(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem('pwa-install-dismissed', String(Date.now()));
    } catch {
      // Ignore storage errors
    }
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.icon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>

        <div className={styles.text}>
          <strong className={styles.title}>Installer BetLeague</strong>
          {showIosPrompt ? (
            <p className={styles.description}>
              Appuie sur{' '}
              <svg className={styles.shareIcon} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3 3h-2v6h-2V5H9l3-3zm-7 9v10h14V11h-2v8H7v-8H5z" />
              </svg>{' '}
              puis "Sur l'écran d'accueil"
            </p>
          ) : (
            <p className={styles.description}>
              Accède plus vite et reçois les notifications push
            </p>
          )}
        </div>

        <div className={styles.actions}>
          {!showIosPrompt && (
            <button className={styles.installBtn} onClick={handleInstall}>
              Installer
            </button>
          )}
          <button className={styles.dismissBtn} onClick={handleDismiss} aria-label="Fermer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});

export default InstallPrompt;
