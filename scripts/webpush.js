/**
 * Web Push Notification module for Adobe Journey Optimizer (AJO)
 *
 * Flow:
 *  1. Register /sw.js as the service worker
 *  2. Request Notification permission from the user (deferred until a
 *     meaningful interaction so browsers don't auto-block it)
 *  3. Subscribe to the browser's Push Manager using the VAPID public key
 *  4. Send the PushSubscription to AJO so it can target this device
 *
 * AJO Web Push relies on the Adobe Web SDK (alloy) being present on the
 * page.  The subscription details are passed via the
 * `pushNotificationSubscribed` XDM event.
 */

// ─── VAPID public key (set in AJO → Channel surfaces → Web push) ─────────────
const VAPID_PUBLIC_KEY =
  'BLqzMdYnzMQir7bAqvmCMD2oHYZ0gK7O1kvJKpZVGSMXoKOku4kYtMHHcFraSDd2m3cov-fcochzuGzG5GXVED4';

// ─── Service-worker path (must be at root so its scope covers the whole site) ──
const SW_PATH = '/sw.js';

// ─── Storage key used to avoid re-subscribing on every page load ──────────────
// Versioned so that any format change automatically invalidates old records
// and forces a fresh AJO registration.
const STORAGE_KEY = 'acc_push_subscribed_v2';

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

  const permission = await Notification.requestPermission();
  return permission;
}

// ─── Push Subscription ────────────────────────────────────────────────────────

/**
 * Subscribe (or return an existing subscription) via the PushManager.
 * @param {ServiceWorkerRegistration} registration
 * @returns {Promise<PushSubscription>}
 */
async function subscribeToPush(registration) {
  // Return any existing subscription first
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

// ─── AJO Integration ─────────────────────────────────────────────────────────

/**
 * Send the push subscription to Adobe Journey Optimizer via the Web SDK
 * (window.alloy).  The XDM schema follows the AJO web-push channel spec.
 *
 * @param {PushSubscription} subscription
 * @returns {Promise<void>}
 */
async function registerWithAJO(subscription) {
  if (typeof window.alloy !== 'function') {
    // eslint-disable-next-line no-console
    console.warn('[WebPush] Adobe Web SDK (alloy) not found. Subscription stored locally only.');
    return;
  }

  const subJson = subscription.toJSON();

  // Resolve identity: prefer the ECID from alloy if available,
  // otherwise fall back to any email stored by the page (e.g. post-login).
  let identityMap;
  try {
    // Check if the page has stored a known email identity after login
    const storedEmail = localStorage.getItem('acc_user_email');
    if (storedEmail) {
      identityMap = {
        email: [{ id: storedEmail, primary: true, authenticatedState: 'authenticated' }],
      };
    }
  } catch { /* ignore */ }

  try {
    const xdm = {
      eventType: 'pushNotificationSubscribed',
      // identityMap must be a TOP-LEVEL XDM field — NOT inside pushNotificationDetails
      ...(identityMap && { identityMap }),
      pushNotificationDetails: {
        appID: window.location.hostname,
        token: subJson.keys.p256dh,
        platform: 'web',
        denylisted: false,
      },
      // Pass the full subscription for AJO to store
      _experience: {
        customerJourneyManagement: {
          pushChannelContext: {
            platform: 'web',
            endpoint: subJson.endpoint,
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
        },
      },
    };

    await window.alloy('sendEvent', { xdm });
    // eslint-disable-next-line no-console
    console.log('[WebPush] Subscription registered with AJO successfully.');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[WebPush] Failed to register subscription with AJO:', err);
  }
}

/**
 * Persist subscription JSON + current identity fingerprint to localStorage
 * so we can detect both stale push tokens and identity changes.
 * @param {PushSubscription} subscription
 */
function persistSubscription(subscription) {
  try {
    const record = {
      ...subscription.toJSON(),
      // Include a fingerprint of the current identity so we re-register
      // whenever the logged-in user changes (e.g. email updates).
      _identity: localStorage.getItem('acc_user_email') || '',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable — not critical
  }
}

/**
 * Returns true ONLY when:
 *  1. The stored push endpoint still matches the live subscription, AND
 *  2. The stored identity fingerprint matches the current identity.
 *
 * If either changes, we re-register with AJO so the subscription is always
 * tied to the correct identity.
 *
 * @param {PushSubscription} subscription
 * @returns {boolean}
 */
function isSubscriptionFresh(subscription) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!stored) return false;

    const endpointMatch = stored.endpoint === subscription.toJSON().endpoint;
    const currentIdentity = localStorage.getItem('acc_user_email') || '';
    const identityMatch = (stored._identity || '') === currentIdentity;

    return endpointMatch && identityMatch;
  } catch {
    return false;
  }
}

// ─── Push Subscription Change Listener ───────────────────────────────────────

/**
 * Listen for SW messages about renewed subscriptions (pushsubscriptionchange)
 * and re-register them with AJO.
 *
 * Note: the listener is synchronous (does NOT return true) to avoid the
 * "message channel closed before a response was received" browser warning
 * that occurs when an async message handler doesn't respond in time.
 */
function listenForSubscriptionChanges() {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PUSH_SUBSCRIPTION_CHANGE') {
      // eslint-disable-next-line no-console
      console.log('[WebPush] Subscription renewed — re-registering with AJO.');
      // Fire-and-forget: don't return the Promise to the message channel
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((subscription) => {
          if (subscription) {
            persistSubscription(subscription);
            return registerWithAJO(subscription);
          }
          return null;
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('[WebPush] Failed to re-register after subscription change:', err);
        });
    }
    // Intentionally return undefined (not true / not a Promise) so the
    // browser does not keep the message channel open and produce warnings.
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise web push:
 *  - Registers the service worker
 *  - Requests permission (only if not already decided)
 *  - Subscribes to push
 *  - Registers the subscription with AJO
 *
 * Call this after a meaningful user interaction (e.g. button click, page scroll)
 * to maximise browser opt-in rates.
 *
 * @param {object} [options]
 * @param {boolean} [options.immediate=false]
 *   When true the permission prompt is shown immediately (useful when the user
 *   has already opted-in or you show your own pre-permission UI first).
 * @returns {Promise<{status: string, subscription?: PushSubscription}>}
 */
export async function initWebPush({ immediate = false } = {}) {
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

  // Start listening for subscription renewal messages from the SW
  listenForSubscriptionChanges();

  // Respect previously denied permission — never pester the user again
  if (Notification.permission === 'denied') {
    // eslint-disable-next-line no-console
    console.warn('[WebPush] Notifications are blocked by the user.');
    return { status: 'denied' };
  }

  // If the user hasn't decided yet and we're not in immediate mode,
  // attach a one-time listener to the first scroll/click instead.
  if (!immediate && Notification.permission === 'default') {
    // eslint-disable-next-line no-console
    console.log('[WebPush] Deferring permission prompt to first user interaction.');
    return new Promise((resolve) => {
      const triggerEvents = ['click', 'scroll', 'keydown', 'touchstart'];

      async function onInteraction() {
        triggerEvents.forEach((evt) => document.removeEventListener(evt, onInteraction, { once: true }));
        const result = await initWebPush({ immediate: true });
        resolve(result);
      }

      triggerEvents.forEach((evt) =>
        document.addEventListener(evt, onInteraction, { once: true, passive: true }),
      );
    });
  }

  // ── Request permission ────────────────────────────────────────────────────
  const permission = await requestPermission();
  if (permission !== 'granted') {
    // eslint-disable-next-line no-console
    console.warn(`[WebPush] Permission ${permission}.`);
    return { status: permission };
  }

  // ── Subscribe ─────────────────────────────────────────────────────────────
  let subscription;
  try {
    subscription = await subscribeToPush(registration);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[WebPush] Push subscription failed:', err);
    return { status: 'subscription-failed', error: err };
  }

  // ── Register with AJO (only when subscription is new / changed) ───────────
  if (!isSubscriptionFresh(subscription)) {
    persistSubscription(subscription);
    await registerWithAJO(subscription);
  } else {
    // eslint-disable-next-line no-console
    console.log('[WebPush] Subscription is already registered and fresh.');
  }

  return { status: 'granted', subscription };
}

/**
 * Unsubscribe from push notifications and notify AJO.
 * @returns {Promise<void>}
 */
export async function unsubscribeWebPush() {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    // eslint-disable-next-line no-console
    console.log('[WebPush] No active subscription to unsubscribe.');
    return;
  }

  await subscription.unsubscribe();

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }

  // Optionally inform AJO that the token is no longer valid
  if (typeof window.alloy === 'function') {
    try {
      await window.alloy('sendEvent', {
        xdm: {
          eventType: 'pushNotificationUnsubscribed',
          pushNotificationDetails: {
            appID: window.location.hostname,
            token: subscription.toJSON().keys.p256dh,
            platform: 'web',
            denylisted: true,
          },
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[WebPush] Failed to notify AJO of unsubscription:', err);
    }
  }

  // eslint-disable-next-line no-console
  console.log('[WebPush] Unsubscribed successfully.');
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
