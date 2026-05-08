import { memo, useCallback, useRef, useState } from 'react';
import styles from './NotificationsPanel.module.css';
import { useNotificationsStore } from '../../store/notificationsStore';
import type { NotificationType } from '../../types/entities/notification';

// ============================================================================
// Utils
// ============================================================================

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) return "À l'instant";
  if (minutes === 1) return 'Il y a 1 min';
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours === 1) return 'Il y a 1h';
  if (hours < 24) return `Il y a ${hours}h`;
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days}j`;
  if (weeks === 1) return 'Il y a 1 sem.';
  if (weeks < 4) return `Il y a ${weeks} sem.`;

  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

// ============================================================================
// Icons par type de notification
// ============================================================================

interface IconProps {
  className?: string;
}

const TrophyIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const CheckCircleIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const XCircleIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </svg>
);

const MailIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const CalendarIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
  </svg>
);

const FlagIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" x2="4" y1="22" y2="15" />
  </svg>
);

const MegaphoneIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 11 18-5v12L3 13v-2z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
);

const UserIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="5" />
    <path d="M20 21a8 8 0 0 0-16 0" />
  </svg>
);

const SoccerIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const TrashIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

function getNotificationIcon(type: NotificationType): React.FC<IconProps> {
  switch (type) {
    case 'bet_won':
      return TrophyIcon;
    case 'bet_lost':
      return XCircleIcon;
    case 'league_invitation':
      return MailIcon;
    case 'league_invitation_accepted':
      return CheckCircleIcon;
    case 'league_invitation_refused':
      return XCircleIcon;
    case 'match_result':
      return SoccerIcon;
    case 'league_started':
      return FlagIcon;
    case 'league_ended':
      return CheckCircleIcon;
    case 'league_overtaken':
      return UserIcon;
    case 'system_announcement':
      return MegaphoneIcon;
    case 'account_update':
      return UserIcon;
    case 'ticket_created':
      return CalendarIcon;
    case 'generic':
    default:
      return CalendarIcon;
  }
}

function getNotificationStyle(type: NotificationType): string {
  switch (type) {
    case 'bet_won':
      return styles.typeWin;
    case 'bet_lost':
      return styles.typeLoss;
    case 'league_invitation':
      return styles.typeInvite;
    case 'league_invitation_accepted':
      return styles.typeLeague;
    case 'league_invitation_refused':
      return styles.typeLoss;
    case 'match_result':
      return styles.typeMatch;
    case 'league_started':
    case 'league_ended':
    case 'league_overtaken':
      return styles.typeLeague;
    case 'system_announcement':
      return styles.typeSystem;
    case 'account_update':
      return styles.typeAccount;
    case 'ticket_created':
      return styles.typeMatch;
    case 'generic':
    default:
      return '';
  }
}

// ============================================================================
// Swipe to Delete Hook
// ============================================================================

function useSwipeToDelete(onDelete: () => void) {
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);
  const [dx, setDx] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const threshold = 80;
  const max = 120;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    startX.current = e.clientX;
    dragging.current = true;
    setDx(0);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || startX.current == null) return;
    const delta = e.clientX - startX.current;
    if (delta >= 0) {
      setDx(0);
      return;
    }
    setDx(Math.max(delta, -max));
  }, []);

  const end = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;

    if (Math.abs(dx) >= threshold) {
      setDismissed(true);
      window.setTimeout(() => {
        onDelete();
      }, 150);
    } else {
      setDx(0);
    }
  }, [dx, onDelete]);

  const onPointerUp = useCallback(() => end(), [end]);
  const onPointerCancel = useCallback(() => end(), [end]);

  return {
    dx,
    dismissed,
    swipeProgress: Math.min(Math.abs(dx) / threshold, 1),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
}

// ============================================================================
// Empty State
// ============================================================================

const EmptyState = memo(function EmptyState() {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
          <path
            d="M40 20C40 20 30 28 30 38C30 48 40 56 40 56C40 56 50 48 50 38C50 28 40 20 40 20Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.5"
          />
          <circle cx="40" cy="38" r="4" fill="currentColor" opacity="0.3" />
          <path d="M28 60L52 60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
        </svg>
      </div>
      <h3 className={styles.emptyTitle}>Aucune notification</h3>
      <p className={styles.emptyText}>
        Les résultats de tes paris et les invitations de ligue apparaîtront ici.
      </p>
    </div>
  );
});

// ============================================================================
// Skeleton Loading
// ============================================================================

const SkeletonItem = memo(function SkeletonItem() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonIcon} />
      <div className={styles.skeletonContent}>
        <div className={styles.skeletonLine} style={{ width: '60%' }} />
        <div className={styles.skeletonLine} style={{ width: '90%' }} />
        <div className={styles.skeletonLine} style={{ width: '40%' }} />
      </div>
    </div>
  );
});

// ============================================================================
// Notification Row
// ============================================================================

interface NotificationRowProps {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: number;
  unread: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

const NotificationRow = memo(function NotificationRow({
  type,
  title,
  message,
  createdAt,
  unread,
  onOpen,
  onDelete,
}: NotificationRowProps) {
  const swipe = useSwipeToDelete(onDelete);
  const Icon = getNotificationIcon(type);
  const typeStyle = getNotificationStyle(type);

  const itemClasses = [
    styles.item,
    unread ? styles.unread : '',
    swipe.dismissed ? styles.dismissed : '',
    typeStyle,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.rowWrap}>
      {/* Background rouge pour swipe delete */}
      <div
        className={styles.rowBg}
        style={{ opacity: swipe.swipeProgress * 0.8 }}
        aria-hidden="true"
      >
        <TrashIcon className={styles.rowBgIcon} />
        <span className={styles.rowBgText}>Supprimer</span>
      </div>

      <button
        type="button"
        className={itemClasses}
        style={{ transform: `translateX(${swipe.dx}px)` }}
        onClick={onOpen}
        {...swipe.handlers}
      >
        <div className={styles.iconWrap}>
          <Icon className={styles.typeIcon} />
          {unread && <span className={styles.unreadDot} aria-hidden="true" />}
        </div>

        <div className={styles.content}>
          <div className={styles.itemTop}>
            <span className={styles.itemTitle}>{title}</span>
            <span className={styles.itemTime}>{formatRelativeTime(createdAt)}</span>
          </div>
          <p className={styles.itemMsg}>{message}</p>
        </div>
      </button>

      {/* Bouton delete fallback pour desktop (hover) */}
      <button
        type="button"
        className={styles.deleteFallback}
        onClick={onDelete}
        aria-label="Supprimer la notification"
        title="Supprimer"
      >
        <TrashIcon className={styles.deleteIcon} />
      </button>
    </div>
  );
});

// ============================================================================
// Panel Principal
// ============================================================================

interface NotificationsPanelProps {
  hideHeader?: boolean;
}

export const NotificationsPanel = memo(function NotificationsPanel({
  hideHeader = false,
}: NotificationsPanelProps) {
  const items = useNotificationsStore((s) => s.items);
  const isLoading = useNotificationsStore((s) => s.isLoading);
  const nextCursor = useNotificationsStore((s) => s.nextCursor);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const loadMore = useNotificationsStore((s) => s.loadMore);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const deleteOne = useNotificationsStore((s) => s.deleteOne);

  const handleMarkAllRead = useCallback(() => {
    void markAllRead();
  }, [markAllRead]);

  const handleLoadMore = useCallback(() => {
    void loadMore();
  }, [loadMore]);

  // Initial loading state
  if (isLoading && items.length === 0) {
    return (
      <section className={styles.panel}>
        {!hideHeader && (
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <h2 className={styles.title}>Notifications</h2>
              <p className={styles.subtitle}>Activité de tes ligues</p>
            </div>
          </header>
        )}
        <div className={styles.list}>
          <SkeletonItem />
          <SkeletonItem />
          <SkeletonItem />
        </div>
        {/* Préférences push déplacées dans Profil > Préférences */}
      </section>
    );
  }

  // Empty state
  if (!isLoading && items.length === 0) {
    return (
      <section className={styles.panel}>
        {!hideHeader && (
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <h2 className={styles.title}>Notifications</h2>
              <p className={styles.subtitle}>Activité de tes ligues</p>
            </div>
          </header>
        )}
        <EmptyState />
        {/* Préférences push déplacées dans Profil > Préférences */}
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      {!hideHeader && (
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>Notifications</h2>
            <p className={styles.subtitle}>
              {unreadCount > 0
                ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
                : 'Toutes lues'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              className={styles.markAllBtn}
              type="button"
              onClick={handleMarkAllRead}
            >
              <CheckCircleIcon className={styles.markAllIcon} />
              <span>Tout lire</span>
            </button>
          )}
        </header>
      )}

      <div className={styles.list} role="list">
        {items.map((n) => (
          <NotificationRow
            key={n.id}
            id={n.id}
            type={n.type}
            title={n.title}
            message={n.message}
            createdAt={n.created_at}
            unread={!n.read_at}
            onOpen={() => void markRead(n.id)}
            onDelete={() => void deleteOne(n.id)}
          />
        ))}
      </div>

      <div className={styles.footer}>
        {nextCursor ? (
          <button
            className={styles.loadMore}
            type="button"
            onClick={handleLoadMore}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner} />
                Chargement...
              </>
            ) : (
              'Charger plus'
            )}
          </button>
        ) : items.length > 0 ? (
          <p className={styles.endText}>Tu as tout vu</p>
        ) : null}
      </div>

      {/* Préférences push déplacées dans Profil > Préférences */}
    </section>
  );
});
