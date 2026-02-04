import http from '../http';

export type NotificationItem = {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  created_at: number;
  read_at: number | null;
};

export type NotificationsListResponse = {
  items: NotificationItem[];
  next_cursor: string | null;
};

export async function listNotifications(params: { limit?: number; cursor?: string | null }) {
  const { limit = 20, cursor = null } = params;
  const res = await http.get<NotificationsListResponse>(`/notifications?limit=${encodeURIComponent(String(limit))}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
  if (!res.success) throw new Error(res.error || 'Erreur notifications');
  return res.data as NotificationsListResponse;
}

export async function getUnreadCount() {
  const res = await http.get<{ count: number }>(`/notifications/unread-count`);
  if (!res.success) throw new Error(res.error || 'Erreur unread-count');
  return res.data as { count: number };
}

export async function markNotificationRead(notificationId: number) {
  const res = await http.post<void>(`/notifications/${notificationId}/read`);
  if (!res.success) throw new Error(res.error || 'Erreur mark read');
}

export async function markAllNotificationsRead() {
  const res = await http.post<{ updated: number }>(`/notifications/read-all`);
  if (!res.success) throw new Error(res.error || 'Erreur mark all read');
  return res.data as { updated: number };
}

export async function deleteNotification(notificationId: number) {
  const res = await http.delete<void>(`/notifications/${notificationId}`);
  if (!res.success) throw new Error(res.error || 'Erreur suppression notification');
}
