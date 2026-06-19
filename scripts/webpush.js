/**
 * Web Push Notification module
 *
 * Responsibilities:
 *  1. Request Notification permission from the user
 *  2. Send the push subscription to AEP via alloy("sendPushSubscription")
 *     after the service worker is fully active and a PushSubscription exists.
 *
 * Service worker registration and push delivery are handled by the AJO Web
 * SDK (alloy) via alloyServiceWorker.js.
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
/**
 * Wait for the service worker to be active and for a PushSubscription to
 * exist, then call alloy("sendPushSubscription") to register the token with
 * AEP / AJO.
 *
 * Must only be called AFTER Notification.permission === 'granted'.
 *
 * @returns {Promise<void>}
 */
export async function sendPushSubscriptionToAEP() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    // eslint-disable-next-line no-console
    console.warn('[WebPush] sendPushSubscriptionToAEP: push not supported, skipping.');
    return;
  }

  if (typeof window.alloy !== 'function') {
    // eslint-disable-next-line no-console
    console.warn('[WebPush] sendPushSubscriptionToAEP: window.alloy is not available yet, skipping.');
    return;
  }

  try {
    // Wait until the service worker is fully activated.
    // alloy("sendPushSubscription") internally calls PushManager.subscribe()
    // with the VAPID key from the AJO channel surface — it both creates the
    // subscription AND sends it to AEP in a single call.
    // An active SW is required for PushManager.subscribe() to succeed.
    const registration = await navigator.serviceWorker.ready;
    // eslint-disable-next-line no-console
    console.log('[WebPush] SW ready. scriptURL:', registration.active?.scriptURL);

    // Single call: Alloy creates the PushSubscription (PushManager.subscribe)
    // and sends the resulting token to AEP in one round trip.
    await window.alloy('sendPushSubscription');

    // Confirm the subscription now exists for debugging purposes
    const subscription = await registration.pushManager.getSubscription();
    // eslint-disable-next-line no-console
    console.log('[WebPush] Push subscription endpoint:', subscription?.endpoint ?? 'none');
    // eslint-disable-next-line no-console
    console.log('[WebPush] sendPushSubscription sent to AEP ✅');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[WebPush] sendPushSubscriptionToAEP error:', err);
    throw err;
  }
}

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
