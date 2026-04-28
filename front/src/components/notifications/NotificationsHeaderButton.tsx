import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { NotificationsBell } from './NotificationsBell';
import { NotificationsDrawer } from './NotificationsDrawer';
import { NotificationsStream } from '../../services/realtime/notificationsStream';
import { useNotificationsStore } from '../../store/notificationsStore';
import type { NotificationItem } from '../../services/api/notifications';
import { useAuthStore } from '../../store/authStore';
import enhancedAuthService from '../../services/authService.enhanced';

export const NotificationsHeaderButton = memo(function NotificationsHeaderButton() {
  const [isOpen, setIsOpen] = useState(false);
  const hydrate = useNotificationsStore((s) => s.hydrate);
  const pushFromRealtime = useNotificationsStore((s) => s.pushFromRealtime);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authToken = useAuthStore((s) => s.token);

  // 1 instance de stream, réutilisée au reconnect
  const streamRef = useRef<NotificationsStream | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    // hydrate initial (unread + list)
    void hydrate();
  }, [isAuthenticated, hydrate]);

  useEffect(() => {
    if (!isAuthenticated) {
      // coupe le stream dès qu'on n'est plus auth
      streamRef.current?.stop();
      return;
    }

    const token = authToken || enhancedAuthService.getCurrentToken();
    if (!token) {
      // token pas encore dispo (rehydrate en cours): ne démarre pas, on retentera au prochain render.
      return;
    }

    if (!streamRef.current) streamRef.current = new NotificationsStream();
    const stream = streamRef.current;

    stream.start({
      onMessage: (msg) => {
        if (msg?.type === 'notification.created' && msg.notification) {
          pushFromRealtime(msg.notification as NotificationItem);
        }
      },
    });

    return () => {
      stream.stop();
    };
  }, [isAuthenticated, authToken, pushFromRealtime]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <>
      <NotificationsBell onClick={handleOpen} />
      <NotificationsDrawer isOpen={isOpen} onClose={handleClose} />
    </>
  );
});
