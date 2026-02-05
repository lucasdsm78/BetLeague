/**
 * Push Notification Service
 *
 * Manages Web Push subscriptions with VAPID authentication.
 * Handles service worker registration, subscription management,
 * and communication with the backend API.
 */

import http from '../http';

// Types
export interface PushSubscriptionStatus {
  subscribed: boolean;
  subscription_count: number;
}

export interface VapidKeyResponse {
  public_key: string;
}

// Service Worker Registration
let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Check if push notifications are supported in the browser
 */
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get the current notification permission status
 */
export function getPermissionStatus(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.requestPermission();
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Push] Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    swRegistration = registration;
    console.log('[Push] Service worker registered');
    return registration;
  } catch (error) {
    console.error('[Push] Service worker registration failed:', error);
    return null;
  }
}

/**
 * Get the current service worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistration) {
    return swRegistration;
  }

  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    swRegistration = registration || null;
    return swRegistration;
  } catch (error) {
    console.error('[Push] Failed to get service worker registration:', error);
    return null;
  }
}

/**
 * Convert VAPID public key from base64 URL to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Get the VAPID public key from the server
 */
export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const response = await http.get<VapidKeyResponse>('/push/vapid-public-key');
    if (!response.success || !response.data) {
      console.error('[Push] Failed to fetch VAPID public key');
      return null;
    }
    return response.data.public_key;
  } catch (error) {
    console.error('[Push] Error fetching VAPID public key:', error);
    return null;
  }
}

/**
 * Get the current push subscription status
 */
export async function getPushStatus(): Promise<PushSubscriptionStatus | null> {
  try {
    const response = await http.get<PushSubscriptionStatus>('/push/status');
    if (!response.success || !response.data) {
      return null;
    }
    return response.data;
  } catch (error) {
    console.error('[Push] Error fetching push status:', error);
    return null;
  }
}

/**
 * Check if the browser has an active push subscription
 */
export async function getLocalSubscription(): Promise<PushSubscription | null> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return null;
  }

  try {
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('[Push] Error getting local subscription:', error);
    return null;
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<boolean> {
  // Check support
  if (!isPushSupported()) {
    console.warn('[Push] Push notifications not supported');
    return false;
  }

  // Request permission
  const permission = await requestPermission();
  if (permission !== 'granted') {
    console.warn('[Push] Notification permission denied');
    return false;
  }

  // Get service worker registration
  let registration = await getServiceWorkerRegistration();
  if (!registration) {
    registration = await registerServiceWorker();
    if (!registration) {
      return false;
    }
  }

  // Get VAPID public key
  const vapidPublicKey = await getVapidPublicKey();
  if (!vapidPublicKey) {
    console.error('[Push] Could not get VAPID public key');
    return false;
  }

  try {
    // Subscribe to push manager
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    // Extract keys
    const rawKey = subscription.getKey('p256dh');
    const rawAuth = subscription.getKey('auth');

    if (!rawKey || !rawAuth) {
      console.error('[Push] Could not get subscription keys');
      return false;
    }

    // Convert to base64
    const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey))));
    const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))));

    // Send to backend
    const response = await http.post('/push/subscribe', {
      endpoint: subscription.endpoint,
      keys: { p256dh, auth },
    });

    if (!response.success) {
      console.error('[Push] Backend subscription failed');
      return false;
    }

    console.log('[Push] Successfully subscribed to push notifications');
    return true;
  } catch (error) {
    console.error('[Push] Subscription error:', error);
    return false;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  const subscription = await getLocalSubscription();

  if (!subscription) {
    console.log('[Push] No local subscription to unsubscribe');
    return true;
  }

  try {
    // Unsubscribe from browser
    await subscription.unsubscribe();

    // Notify backend
    await http.post('/push/unsubscribe', {
      endpoint: subscription.endpoint,
    });

    console.log('[Push] Successfully unsubscribed from push notifications');
    return true;
  } catch (error) {
    console.error('[Push] Unsubscribe error:', error);
    return false;
  }
}

/**
 * Unsubscribe from all push notifications
 */
export async function unsubscribeAll(): Promise<boolean> {
  try {
    // Unsubscribe local
    const subscription = await getLocalSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    // Notify backend to remove all
    await http.delete('/push/unsubscribe-all');

    console.log('[Push] Successfully unsubscribed from all push notifications');
    return true;
  } catch (error) {
    console.error('[Push] Unsubscribe all error:', error);
    return false;
  }
}

/**
 * Initialize push notifications service
 * Call this on app startup
 */
export async function initPushService(): Promise<void> {
  if (!isPushSupported()) {
    console.log('[Push] Push notifications not supported');
    return;
  }

  // Register service worker
  await registerServiceWorker();

  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
      // Dispatch custom event for React to handle
      window.dispatchEvent(
        new CustomEvent('push-notification-click', {
          detail: event.data.data,
        })
      );
    }
  });
}

// Export singleton-style service
const pushNotificationService = {
  isPushSupported,
  getPermissionStatus,
  requestPermission,
  registerServiceWorker,
  getVapidPublicKey,
  getPushStatus,
  getLocalSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  unsubscribeAll,
  initPushService,
};

export default pushNotificationService;
