import { memo, useEffect, useId, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useNotificationsStore } from '../../store/notificationsStore';
import styles from './NotificationsDrawer.module.css';
import { NotificationsPanel } from './NotificationsPanel';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const CheckAllIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 7 17l-5-5" />
    <path d="m22 10-7.5 7.5L13 16" />
  </svg>
);

export const NotificationsDrawer = memo(function NotificationsDrawer({
  isOpen,
  onClose,
}: NotificationsDrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);

  useBodyScrollLock(isOpen);

  const handleMarkAllRead = useCallback(() => {
    void markAllRead();
  }, [markAllRead]);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Focus management
  useEffect(() => {
    if (!isOpen) return;

    const el = panelRef.current;
    el?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <div className={styles.root} role="presentation">
      {/* Backdrop */}
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Fermer les notifications"
        onClick={onClose}
        tabIndex={-1}
      />

      {/* Drawer Panel */}
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panelRef}
      >
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 id={titleId} className={styles.title}>
              Notifications
            </h2>
            {unreadCount > 0 && (
              <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </div>

          <div className={styles.headerActions}>
            {unreadCount > 0 && (
              <button
                type="button"
                className={styles.markAllBtn}
                onClick={handleMarkAllRead}
                aria-label="Tout marquer comme lu"
                title="Tout marquer comme lu"
              >
                <CheckAllIcon />
              </button>
            )}
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Fermer"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className={styles.content}>
          <NotificationsPanel hideHeader />
        </div>
      </aside>
    </div>
  );

  return createPortal(content, document.body);
});
