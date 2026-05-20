/**
 * Service Worker
 *
 * Handles install/activate lifecycle only.
 * Push notification delivery, notificationclick, and pushsubscriptionchange
 * are handled by the AJO Web SDK via /alloyServiceWorker.js.
 */

const CACHE_NAME = 'acc-commerce-v1';

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', () => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
