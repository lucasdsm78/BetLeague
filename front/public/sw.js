/* eslint-disable no-restricted-globals */

/**
 * BetLeague Service Worker for Push Notifications
 * Handles background push events and notification clicks
 */

const CACHE_NAME = 'betleague-v1';
const DEFAULT_ICON = '/icons/notification-icon.svg';
const DEFAULT_BADGE = '/icons/badge-icon.svg';

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Push event - display notification
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[SW] Push event without data');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      title: 'BetLeague',
      body: event.data.text(),
    };
  }

  const {
    title = 'BetLeague',
    body = '',
    icon = DEFAULT_ICON,
    badge = DEFAULT_BADGE,
    tag,
    data = {},
    url,
  } = payload;

  const options = {
    body,
    icon,
    badge,
    tag: tag || `betleague-${Date.now()}`,
    data: { ...data, url },
    vibrate: [100, 50, 100],
    requireInteraction: false,
    renotify: Boolean(tag),
    actions: [
      { action: 'open', title: 'Voir' },
      { action: 'close', title: 'Fermer' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'close') {
    return;
  }

  // Determine URL to open
  let targetUrl = data.url || '/notifications';

  // Make absolute URL
  if (!targetUrl.startsWith('http')) {
    targetUrl = new URL(targetUrl, self.location.origin).href;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if already open
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: data,
          });
          return client.focus();
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Message event - handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
