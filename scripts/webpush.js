/**
 * Web Push Notification module
 *
 * Responsibilities:
 *  1. Request Notification permission from the user
 *
 * Push subscription, service worker registration, and delivery are handled
 * by the AJO Web SDK (alloy) via alloyServiceWorker.js.
 */

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
 *  - Requests Notification permission from the user
 *
 * Service worker registration is handled by the AJO Web SDK (alloy).
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
