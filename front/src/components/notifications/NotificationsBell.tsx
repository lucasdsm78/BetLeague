import { useEffect, useMemo, useRef, memo, useCallback } from 'react';
import styles from './NotificationsBell.module.css';
import { useNotificationsStore } from '../../store/notificationsStore';
import { NotificationsStream } from '../../services/realtime/notificationsStream';
import type { NotificationItem } from '../../services/api/notifications';

interface NotificationsBellProps {
  onClick?: () => void;
}

export const NotificationsBell = memo(function NotificationsBell({ onClick }: NotificationsBellProps) {
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const hydrate = useNotificationsStore((s) => s.hydrate);
  const pushFromRealtime = useNotificationsStore((s) => s.pushFromRealtime);

  const streamRef = useRef<NotificationsStream | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const stream = new NotificationsStream();
    streamRef.current = stream;

    stream.start({
      onMessage: (msg) => {
        if (msg.type === 'notification.created' && 'notification' in msg) {
          pushFromRealtime(msg.notification as NotificationItem);
        }
      },
    });

    return () => stream.stop();
  }, [pushFromRealtime]);

  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  const badge = useMemo(() => {
    if (unreadCount <= 0) return null;
    const label = unreadCount > 99 ? '99+' : String(unreadCount);
    return (
      <span className={styles.badge} data-count={label}>
        {label}
      </span>
    );
  }, [unreadCount]);

  const hasUnread = unreadCount > 0;

  return (
    <button
      className={`${styles.button} ${hasUnread ? styles.hasUnread : ''}`}
      type="button"
      onClick={handleClick}
      aria-label={`Notifications${hasUnread ? `, ${unreadCount} non lues` : ''}`}
      aria-haspopup="dialog"
    >
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {badge}
      {hasUnread && <span className={styles.pulse} aria-hidden="true" />}
    </button>
  );
});
