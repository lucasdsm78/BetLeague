import { useEffect } from 'react';
import styles from './NotificationsPanel.module.css';
import { useNotificationsStore } from '../../store/notificationsStore';

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString();
}

export function NotificationsPanel(props: { hideHeader?: boolean } = {}) {
  const items = useNotificationsStore((s) => s.items);
  const isLoading = useNotificationsStore((s) => s.isLoading);
  const nextCursor = useNotificationsStore((s) => s.nextCursor);
  const loadMore = useNotificationsStore((s) => s.loadMore);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);

  useEffect(() => {
    // nothing, bell hydrates; panel just displays
  }, []);

  return (
    <section className={styles.panel}>
      {!props.hideHeader && (
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>Notifications</h2>
            <p className={styles.subtitle}>Tes dernières activités de ligue</p>
          </div>
          <button className={styles.action} type="button" onClick={() => void markAllRead()}>
            Tout lire
          </button>
        </header>
      )}

      <div className={styles.list}>
        {items.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`${styles.item} ${!n.read_at ? styles.unread : ''}`}
            onClick={() => void markRead(n.id)}
          >
            <div className={styles.itemTop}>
              <div className={styles.itemTitle}>{n.title}</div>
              <div className={styles.itemTime}>{formatTime(n.created_at)}</div>
            </div>
            <div className={styles.itemMsg}>{n.message}</div>
          </button>
        ))}

        <div className={styles.footer}>
          {nextCursor ? (
            <button
              className={styles.loadMore}
              type="button"
              onClick={() => void loadMore()}
              disabled={isLoading}
            >
              {isLoading ? 'Chargement…' : 'Charger plus'}
            </button>
          ) : (
            <div className={styles.end}>Fin des notifications</div>
          )}
        </div>
      </div>
    </section>
  );
}
