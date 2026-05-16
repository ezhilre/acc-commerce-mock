/**
 * Service Worker for Web Push Notifications
 * Handles push events and notification click actions.
 *
 * Imports the Adobe Experience Platform Web SDK service-worker helper so that
 * AJO can use this SW for web push delivery.
 * https://cdn1.adoberesources.net/alloy/2.33.1/alloyServiceWorker.js
 */

// ─── Adobe Alloy SW helper ────────────────────────────────────────────────────
importScripts('https://cdn1.adoberesources.net/alloy/2.33.1/alloyServiceWorker.js');

const CACHE_NAME = 'acc-commerce-v1';

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ),
    ).then(() => self.clients.claim()),
  );
});

// ─── Push ─────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'New Notification', body: event.data.text() };
    }
  }

  const title = data.title || 'ACC Commerce';

  // Build options — omit keys with undefined/null values to avoid
  // silent browser rejections on subsequent notifications.
  const options = {
    body: data.body || 'You have a new notification.',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    data: {
      url: data.url || '/',
      campaignId: data.campaignId || '',
      messageId: data.messageId || '',
    },
    // Use a unique tag per notification so every push is shown as a NEW
    // notification rather than silently replacing the previous one.
    // AJO can supply its own tag via the payload to group related alerts.
    tag: data.tag || `acc-push-${Date.now()}`,
    // renotify must be true when a tag IS provided so the user sees/hears it
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
  };

  // Only include optional fields when explicitly provided
  if (data.image) options.image = data.image;
  if (data.actions && data.actions.length) options.actions = data.actions;

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      // Log and swallow — prevents the SW from crashing on bad payloads
      console.error('[SW] showNotification failed:', err, { title, options });
    }),
  );
});

// ─── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If a window is already open on the target URL, focus it
        for (const client of windowClients) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
        return null;
      }),
  );
});

// ─── Push Subscription Change ─────────────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  // Re-subscribe and notify the page so it can update AJO
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: event.oldSubscription
          ? event.oldSubscription.options.applicationServerKey
          : null,
      })
      .then((subscription) => {
        // Broadcast new subscription to all open clients
        return clients.matchAll({ type: 'window' }).then((windowClients) => {
          windowClients.forEach((client) => {
            client.postMessage({
              type: 'PUSH_SUBSCRIPTION_CHANGE',
              subscription: subscription.toJSON(),
            });
          });
        });
      }),
  );
});
