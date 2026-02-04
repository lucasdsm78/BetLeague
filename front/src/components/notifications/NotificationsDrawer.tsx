import { useEffect, useId, useRef } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import styles from './NotificationsDrawer.module.css';
import { NotificationsPanel } from './NotificationsPanel';

export function NotificationsDrawer(props: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useBodyScrollLock(props.isOpen);

  useEffect(() => {
    if (!props.isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [props.isOpen, props.onClose]);

  useEffect(() => {
    if (!props.isOpen) return;

    // Focus the close button if present, otherwise focus panel.
    const el = panelRef.current;
    el?.focus();
  }, [props.isOpen]);

  if (!props.isOpen) return null;

  return (
    <div className={styles.root} role="presentation">
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Fermer les notifications"
        onClick={props.onClose}
      />

      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panelRef}
      >
        <div className={styles.drawerHeader}>
          <h2 id={titleId} className={styles.drawerTitle}>
            Notifications
          </h2>
          <button type="button" className={styles.close} onClick={props.onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <div className={styles.content}>
          <NotificationsPanel hideHeader />
        </div>
      </aside>
    </div>
  );
}
