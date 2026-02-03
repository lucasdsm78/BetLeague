import { create } from 'zustand';
import { getUnreadCount, listNotifications, markAllNotificationsRead, markNotificationRead } from '../services/api/notifications';
import type { NotificationItem } from '../services/api/notifications';

type NotificationsState = {
  items: NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
  isLoading: boolean;

  hydrate: () => Promise<void>;
  loadMore: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  pushFromRealtime: (n: NotificationItem) => void;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
};

function uniqueById(items: NotificationItem[]) {
  const seen = new Set<number>();
  const out: NotificationItem[] = [];
  for (const n of items) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
  }
  return out;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  nextCursor: null,
  unreadCount: 0,
  isLoading: false,

  hydrate: async () => {
    set({ isLoading: true });
    try {
      const [list, unread] = await Promise.all([
        listNotifications({ limit: 20, cursor: null }),
        getUnreadCount(),
      ]);
      set({
        items: list.items,
        nextCursor: list.next_cursor,
        unreadCount: unread.count,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  loadMore: async () => {
    const { nextCursor, isLoading } = get();
    if (!nextCursor || isLoading) return;

    set({ isLoading: true });
    try {
      const list = await listNotifications({ limit: 20, cursor: nextCursor });
      set({
        items: uniqueById([...get().items, ...list.items]),
        nextCursor: list.next_cursor,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  refreshUnreadCount: async () => {
    const unread = await getUnreadCount();
    set({ unreadCount: unread.count });
  },

  pushFromRealtime: (n: NotificationItem) => {
    const items = get().items;
    const updated = uniqueById([n, ...items]);
    set({ items: updated });

    // Le compteur peut être incohérent si plusieurs streams SSE sont ouverts (desktop + mobile)
    // et/ou si des events arrivent en rafale. On re-synchronise avec la source de vérité.
    void (async () => {
      try {
        const unread = await getUnreadCount();
        set({ unreadCount: unread.count });
      } catch {
        // fallback best-effort: si backend indispo, on incrémente localement
        const wasUnread = n.read_at == null;
        if (wasUnread) set({ unreadCount: get().unreadCount + 1 });
      }
    })();
  },

  markRead: async (id: number) => {
    await markNotificationRead(id);
    // Re-sync avec le backend (source de vérité) pour éviter les compteurs incohérents après refresh.
    const unread = await getUnreadCount();
    set({
      items: get().items.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? Date.now() } : n)),
      unreadCount: unread.count,
    });
  },

  markAllRead: async () => {
    await markAllNotificationsRead();
    // Re-sync complet: après read-all, on recharge unread-count (doit être 0) et on marque localement.
    const unread = await getUnreadCount();
    set({
      items: get().items.map((n) => (n.read_at ? n : { ...n, read_at: Date.now() })),
      unreadCount: unread.count,
    });
  },
}));

