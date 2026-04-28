/* eslint-disable no-restricted-globals */

/**
 * BetLeague Service Worker
 * PWA Caching + Push Notifications
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `betleague-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `betleague-dynamic-${CACHE_VERSION}`;

const DEFAULT_ICON = '/icons/notification-icon.svg';
const DEFAULT_BADGE = '/icons/badge-icon.svg';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg',
  '/icons/notification-icon.svg',
  '/icons/badge-icon.svg',
];

// ============================================================================
// Install - Cache static assets
// ============================================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache failed:', err);
      });
    })
  );
  self.skipWaiting();
});

// ============================================================================
// Activate - Clean old caches
// ============================================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('betleague-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ============================================================================
// Fetch - Network first, cache fallback
// ============================================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, API, SSE, and non-http
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.includes('/stream')) return;
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// ============================================================================
// Push - Display notification
// ============================================================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'BetLeague', body: event.data.text() };
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

  event.waitUntil(self.registration.showNotification(title, options));
});

// ============================================================================
// Notification Click
// ============================================================================
function safeInternalUrl(url) {
  if (!url) return '/';
  try {
    const u = new URL(url, self.location.origin);
    if (u.origin !== self.location.origin) return '/';
    return u.pathname + u.search + u.hash;
  } catch {
    return '/';
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const data = event.notification.data || {};
  let targetUrl = new URL(safeInternalUrl(data.url) || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', data });
          return client.focus();
        }
      }
      return self.clients.openWindow?.(targetUrl);
    })
  );
});

// ============================================================================
// Message handler
// ============================================================================
self.addEventListener('message', (event) => {
  if (!event.data) return;
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'CLEAR_CACHE':
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
      break;
  }
});
