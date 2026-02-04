import { memo, useState, useCallback } from 'react';
import { NotificationsBell } from './NotificationsBell';
import { NotificationsDrawer } from './NotificationsDrawer';

export const NotificationsHeaderButton = memo(function NotificationsHeaderButton() {
  const [isOpen, setIsOpen] = useState(false);

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
