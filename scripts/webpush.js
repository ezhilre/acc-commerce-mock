/**
 * Web Push Notification module
 *
 * Responsibilities:
 *  1. Register /sw.js as the service worker
 *  2. Request Notification permission from the user
 *
 * Push subscription and delivery are handled by the AJO Web SDK
 * (alloy) via alloyServiceWorker.js — this module only gates
 * browser permission and registers the service worker.
 */

// ─── Service-worker path (must be at root so its scope covers the whole site) ──
const SW_PATH = '/sw.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return true only when the Notification + ServiceWorker APIs are available.
 * @returns {boolean}
 */
function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'Notification' in window
  );
}

// ─── Service Worker Registration ──────────────────────────────────────────────

/**
 * Register (or retrieve an existing) service worker registration.
 * @returns {Promise<ServiceWorkerRegistration>}
 */
async function registerServiceWorker() {
  const registration = await navigator.serviceWorker.register(SW_PATH, {
    scope: '/',
  });
  // Wait until the SW is active (handles the first-install case)
  if (registration.installing || registration.waiting) {
    await new Promise((resolve) => {
      const sw = registration.installing || registration.waiting;
      sw.addEventListener('statechange', function onStateChange() {
        if (sw.state === 'activated') {
          sw.removeEventListener('statechange', onStateChange);
          resolve();
        }
      });
    });
  }
  return registration;
}

// ─── Permission ───────────────────────────────────────────────────────────────

/**
 * Ask the user for notification permission.
 * Returns the resulting permission state: 'granted' | 'denied' | 'default'
 * @returns {Promise<NotificationPermission>}
 */
async function requestPermission() {
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise web push:
 *  - Registers the service worker
 *  - Requests Notification permission from the user
 *
 * @param {object} [options]
 * @param {boolean} [options.immediate=false]
 *   When false (default) the permission prompt is deferred until the first
 *   user interaction (click / scroll / keydown / touchstart).
 *   When true the prompt is shown immediately.
 * @returns {Promise<{status: string}>}
 */
export async function initWebPush({ immediate = false } = {}) {
  if (!isPushSupported()) {
    return { status: 'unsupported' };
  }

  try {
    await registerServiceWorker();
  } catch (err) {
    return { status: 'sw-failed', error: err };
  }

  if (Notification.permission === 'denied') {
    return { status: 'denied' };
  }

  // Defer the browser permission prompt until the first user interaction
  if (!immediate && Notification.permission === 'default') {
    return new Promise((resolve) => {
      const triggerEvents = ['click', 'scroll', 'keydown', 'touchstart'];

      async function onInteraction() {
        triggerEvents.forEach((evt) =>
          document.removeEventListener(evt, onInteraction, { once: true }),
        );
        const result = await initWebPush({ immediate: true });
        resolve(result);
      }

      triggerEvents.forEach((evt) =>
        document.addEventListener(evt, onInteraction, { once: true, passive: true }),
      );
    });
  }

  // Request permission
  const permission = await requestPermission();
  return { status: permission };
}
