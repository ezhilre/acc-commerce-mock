/**
 * Web Push Notification module
 *
 * Responsibilities:
 *  1. Register /sw.js as the service worker
 *  2. Request Notification permission from the user
 *  3. Subscribe to the browser's Push Manager using the VAPID public key
 *  4. Return the PushSubscription object to the caller
 *
 * AJO / alloy integration is handled externally via the Web SDK.
 * This module is purely concerned with browser-side push mechanics.
 */

// ─── VAPID public key (set in AJO → Channel surfaces → Web push) ─────────────
const VAPID_PUBLIC_KEY =
  'BLqzMdYnzMQir7bAqvmCMD2oHYZ0gK7O1kvJKpZVGSMXoKOku4kYtMHHcFraSDd2m3cov-fcochzuGzG5GXVED4';

// ─── Service-worker path (must be at root so its scope covers the whole site) ──
const SW_PATH = '/sw.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a URL-safe Base64 string to a Uint8Array.
 * Required by PushManager.subscribe({ applicationServerKey }).
 * @param {string} base64String
 * @returns {Uint8Array}
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

/**
 * Return true only when the Push & Notification APIs are available.
 * @returns {boolean}
 */
function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
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

// ─── Push Subscription ────────────────────────────────────────────────────────

/**
 * Subscribe (or return an existing subscription) via the PushManager.
 * @param {ServiceWorkerRegistration} registration
 * @returns {Promise<PushSubscription>}
 */
async function subscribeToPush(registration) {
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

// ─── Push Subscription Change Listener ───────────────────────────────────────

/**
 * Listen for SW messages about renewed subscriptions (pushsubscriptionchange).
 * Fires the optional onRenew callback so the caller (Web SDK layer) can
 * re-register the new subscription with AJO.
 *
 * The listener is intentionally synchronous (returns undefined) to avoid the
 * "message channel closed before a response was received" browser warning.
 *
 * @param {function(PushSubscription): void} [onRenew]
 */
function listenForSubscriptionChanges(onRenew) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PUSH_SUBSCRIPTION_CHANGE') {
      // eslint-disable-next-line no-console
      console.log('[WebPush] Subscription renewed.');
      if (typeof onRenew === 'function') {
        navigator.serviceWorker.ready
          .then((reg) => reg.pushManager.getSubscription())
          .then((subscription) => {
            if (subscription) onRenew(subscription);
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error('[WebPush] Failed to retrieve renewed subscription:', err);
          });
      }
    }
    // Return undefined — don't hold the message channel open.
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise web push:
 *  - Registers the service worker
 *  - Requests Notification permission from the user
 *  - Creates (or retrieves) the PushSubscription
 *  - Returns the subscription so the caller can pass it to AJO / alloy
 *
 * @param {object} [options]
 * @param {boolean} [options.immediate=false]
 *   When false (default) the permission prompt is deferred until the first
 *   user interaction (click / scroll / keydown / touchstart).
 *   When true the prompt is shown immediately.
 * @param {function(PushSubscription): void} [options.onRenew]
 *   Optional callback invoked when the browser auto-renews the subscription
 *   (pushsubscriptionchange). Use this to re-send the new token to AJO.
 * @returns {Promise<{status: string, subscription?: PushSubscription}>}
 */
export async function initWebPush({ immediate = false, onRenew } = {}) {
  if (!isPushSupported()) {
    // eslint-disable-next-line no-console
    console.warn('[WebPush] Push notifications are not supported in this browser.');
    return { status: 'unsupported' };
  }

  let registration;
  try {
    registration = await registerServiceWorker();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[WebPush] Service worker registration failed:', err);
    return { status: 'sw-failed', error: err };
  }

  // Wire up subscription-renewal listener
  listenForSubscriptionChanges(onRenew);

  if (Notification.permission === 'denied') {
    // eslint-disable-next-line no-console
    console.warn('[WebPush] Notifications are blocked by the user.');
    return { status: 'denied' };
  }

  // Defer the browser permission prompt until the first user interaction
  if (!immediate && Notification.permission === 'default') {
    // eslint-disable-next-line no-console
    console.log('[WebPush] Deferring permission prompt to first user interaction.');
    return new Promise((resolve) => {
      const triggerEvents = ['click', 'scroll', 'keydown', 'touchstart'];

      async function onInteraction() {
        triggerEvents.forEach((evt) =>
          document.removeEventListener(evt, onInteraction, { once: true }),
        );
        const result = await initWebPush({ immediate: true, onRenew });
        resolve(result);
      }

      triggerEvents.forEach((evt) =>
        document.addEventListener(evt, onInteraction, { once: true, passive: true }),
      );
    });
  }

  // Request permission
  const permission = await requestPermission();
  if (permission !== 'granted') {
    // eslint-disable-next-line no-console
    console.warn(`[WebPush] Permission ${permission}.`);
    return { status: permission };
  }

  // Create / retrieve push subscription
  let subscription;
  try {
    subscription = await subscribeToPush(registration);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[WebPush] Push subscription failed:', err);
    return { status: 'subscription-failed', error: err };
  }

  // eslint-disable-next-line no-console
  console.log('[WebPush] Subscription ready. Endpoint:', subscription.endpoint);

  return { status: 'granted', subscription };
}

/**
 * Unsubscribe from push notifications.
 * The caller is responsible for notifying AJO via the Web SDK.
 * @returns {Promise<PushSubscription|null>} the unsubscribed subscription (for AJO cleanup), or null
 */
export async function unsubscribeWebPush() {
  if (!isPushSupported()) return null;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    // eslint-disable-next-line no-console
    console.log('[WebPush] No active subscription to unsubscribe.');
    return null;
  }

  await subscription.unsubscribe();
  // eslint-disable-next-line no-console
  console.log('[WebPush] Unsubscribed successfully.');

  // Return the (now-inactive) subscription so the caller can send
  // a pushNotificationUnsubscribed event to AJO via alloy.
  return subscription;
}

/**
 * Return the current push subscription, or null if not subscribed.
 * @returns {Promise<PushSubscription|null>}
 */
export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}
