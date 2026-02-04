import { useEffect, useRef, useState } from 'react';
import styles from './NotificationsPanel.module.css';
import { useNotificationsStore } from '../../store/notificationsStore';

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString();
}

function useSwipeToDelete(onDelete: () => void) {
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);
  const [dx, setDx] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const threshold = 88; // px
  const max = 140;

  const onPointerDown = (e: React.PointerEvent) => {
    // Uniquement touch/pen (évite de casser desktop)
    if (e.pointerType === 'mouse') return;
    startX.current = e.clientX;
    dragging.current = true;
    setDx(0);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || startX.current == null) return;
    const delta = e.clientX - startX.current;
    // swipe vers la gauche uniquement
    if (delta >= 0) {
      setDx(0);
      return;
    }
    setDx(Math.max(delta, -max));
  };

  const end = async () => {
    if (!dragging.current) return;
    dragging.current = false;

    if (Math.abs(dx) >= threshold) {
      setDismissed(true);
      // laisse l'animation finir
      window.setTimeout(() => {
        onDelete();
      }, 120);
    } else {
      setDx(0);
    }
  };

  const onPointerUp = () => void end();
  const onPointerCancel = () => void end();

  return {
    dx,
    dismissed,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
}

export function NotificationsPanel(props: { hideHeader?: boolean } = {}) {
  const items = useNotificationsStore((s) => s.items);
  const isLoading = useNotificationsStore((s) => s.isLoading);
  const nextCursor = useNotificationsStore((s) => s.nextCursor);
  const loadMore = useNotificationsStore((s) => s.loadMore);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const deleteOne = useNotificationsStore((s: any) => s.deleteOne) as (id: number) => Promise<void>;

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
          <NotificationRow
            key={n.id}
            title={n.title}
            createdAt={n.created_at}
            message={n.message}
            unread={!n.read_at}
            onOpen={() => void markRead(n.id)}
            onDelete={() => void deleteOne(n.id)}
          />
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

function NotificationRow(props: {
  title: string;
  createdAt: number;
  message: string;
  unread: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const swipe = useSwipeToDelete(props.onDelete);

  return (
    <div className={styles.rowWrap}>
      <div className={styles.rowBg} aria-hidden="true" />

      <button
        type="button"
        className={`${styles.item} ${props.unread ? styles.unread : ''} ${swipe.dismissed ? styles.dismissed : ''}`}
        style={{ transform: `translateX(${swipe.dx}px)` }}
        onClick={props.onOpen}
        {...swipe.handlers}
      >
        <div className={styles.itemTop}>
          <div className={styles.itemTitle}>{props.title}</div>
          <div className={styles.itemTime}>{formatTime(props.createdAt)}</div>
        </div>
        <div className={styles.itemMsg}>{props.message}</div>
      </button>

      <button
        type="button"
        className={styles.deleteFallback}
        onClick={props.onDelete}
        aria-label="Supprimer la notification"
        title="Supprimer"
      >
        ×
      </button>
    </div>
  );
}
