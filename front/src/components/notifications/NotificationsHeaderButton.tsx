import { useState } from 'react';
import { NotificationsBell } from './NotificationsBell';
import { NotificationsDrawer } from './NotificationsDrawer';

export function NotificationsHeaderButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <NotificationsBell onClick={() => setOpen(true)} />
      <NotificationsDrawer isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
