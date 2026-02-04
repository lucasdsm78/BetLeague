import { useEffect, useMemo, useRef } from 'react';
import styles from './NotificationsBell.module.css';
import { useNotificationsStore } from '../../store/notificationsStore';
import { NotificationsStream } from '../../services/realtime/notificationsStream';
import type { NotificationItem } from '../../services/api/notifications';

export function NotificationsBell(props: { onClick?: () => void }) {
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

  const badge = useMemo(() => {
    if (unreadCount <= 0) return null;
    const label = unreadCount > 99 ? '99+' : String(unreadCount);
    return <span className={styles.badge}>{label}</span>;
  }, [unreadCount]);

  return (
    <button className={styles.button} type="button" onClick={props.onClick} aria-label="Notifications" aria-haspopup="dialog">
      <span className={styles.icon} aria-hidden="true" />
      {badge}
    </button>
  );
}
