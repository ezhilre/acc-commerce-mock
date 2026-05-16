/**
 * Push Permission Banner
 *
 * Injects a sticky bar at the very top of the page (above the site header)
 * that asks the visitor whether they want to receive push notifications.
 *
 * States:
 *  – Default  : permission = 'default' → "Allow / Not now" banner
 *  – Blocked  : permission = 'denied'  → "How to re-enable" info banner
 *  – Loading  : user clicked "Allow"   → spinner while subscribing
 *  – Success  : subscribed             → auto-dismisses after 3 s
 *  – Error    : something went wrong   → retry option
 *
 * The banner respects the user's choice via localStorage so it is not shown
 * repeatedly after an explicit "Not now". It resets automatically whenever
 * the browser permission is set back to the 'default' (Ask) state.
 */

import { initWebPush } from './webpush.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const DISMISSED_KEY = 'acc_push_banner_dismissed';
const BANNER_ID = 'acc-push-banner';

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const BELL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
  aria-hidden="true" focusable="false">
  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
</svg>`;

const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
  aria-hidden="true" focusable="false">
  <polyline points="20 6 9 17 4 12"/>
</svg>`;

const WARN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
  aria-hidden="true" focusable="false">
  <circle cx="12" cy="12" r="10"/>
  <line x1="12" y1="8" x2="12" y2="12"/>
  <line x1="12" y1="16" x2="12.01" y2="16"/>
</svg>`;

// ─── Styles ───────────────────────────────────────────────────────────────────
const BANNER_CSS = `
#${BANNER_ID} {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #1a1a2e;
  color: #fff;
  font-family: var(--body-font-family, sans-serif);
  font-size: 14px;
  line-height: 1.4;
  box-shadow: 0 2px 8px rgba(0,0,0,.35);
  transform: translateY(-100%);
  transition: transform .3s ease;
}

#${BANNER_ID}.acc-push-banner--visible {
  transform: translateY(0);
}

#${BANNER_ID} .acc-push-banner__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  color: #f0c040;
}

#${BANNER_ID} .acc-push-banner__text {
  flex: 1;
  min-width: 0;
}

#${BANNER_ID} .acc-push-banner__text strong {
  display: block;
  font-size: 15px;
  margin-bottom: 1px;
}

#${BANNER_ID} .acc-push-banner__text small {
  display: block;
  opacity: .75;
  font-size: 12px;
  margin-top: 2px;
}

#${BANNER_ID} .acc-push-banner__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

#${BANNER_ID} .acc-push-banner__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border: none;
  border-radius: 20px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background .2s, opacity .2s;
}

#${BANNER_ID} .acc-push-banner__btn--allow {
  background: #3b63fb;
  color: #fff;
}

#${BANNER_ID} .acc-push-banner__btn--allow:hover {
  background: #1d3ecf;
}

#${BANNER_ID} .acc-push-banner__btn--dismiss {
  background: transparent;
  color: rgba(255,255,255,.7);
  border: 1px solid rgba(255,255,255,.3);
}

#${BANNER_ID} .acc-push-banner__btn--dismiss:hover {
  background: rgba(255,255,255,.1);
  color: #fff;
}

#${BANNER_ID} .acc-push-banner__btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

/* Spinner */
#${BANNER_ID} .acc-push-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: acc-push-spin .7s linear infinite;
  flex-shrink: 0;
}

@keyframes acc-push-spin {
  to { transform: rotate(360deg); }
}

/* Success state */
#${BANNER_ID}.acc-push-banner--success {
  background: #1a6b2e;
}

#${BANNER_ID}.acc-push-banner--success .acc-push-banner__icon {
  color: #6ee890;
}

/* Blocked / denied state */
#${BANNER_ID}.acc-push-banner--blocked {
  background: #4a3500;
}

#${BANNER_ID}.acc-push-banner--blocked .acc-push-banner__icon {
  color: #f0c040;
}

/* Error state */
#${BANNER_ID}.acc-push-banner--error {
  background: #7a1a1a;
}

/* Offset body so the banner doesn't overlap content */
body.acc-push-banner-open {
  padding-top: 56px;
  transition: padding-top .3s ease;
}

@media (max-width: 600px) {
  #${BANNER_ID} {
    flex-wrap: wrap;
  }

  #${BANNER_ID} .acc-push-banner__actions {
    width: 100%;
    justify-content: flex-end;
    margin-top: 4px;
  }
}
`;

// ─── localStorage helpers ─────────────────────────────────────────────────────

/**
 * Returns true when the user has actively dismissed the banner AND the
 * current browser permission state is consistent with that choice.
 *
 * Edge-case: if the browser permission was reset to 'default' by the user
 * via browser settings, the stored dismissal is stale — clear it so the
 * banner reappears.
 */
function isDismissed() {
  try {
    if (Notification.permission === 'default') {
      // Permission was reset externally — treat as a fresh visit
      localStorage.removeItem(DISMISSED_KEY);
      return false;
    }
    return !!localStorage.getItem(DISMISSED_KEY);
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch { /* ignore */ }
}

// ─── Style injection ──────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('acc-push-banner-styles')) return;
  const style = document.createElement('style');
  style.id = 'acc-push-banner-styles';
  style.textContent = BANNER_CSS;
  document.head.appendChild(style);
}

// ─── Banner DOM helpers ───────────────────────────────────────────────────────

function showBanner(banner) {
  document.body.classList.add('acc-push-banner-open');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => banner.classList.add('acc-push-banner--visible'));
  });
}

function hideBanner(banner) {
  banner.classList.remove('acc-push-banner--visible');
  document.body.classList.remove('acc-push-banner-open');
  banner.addEventListener('transitionend', () => banner.remove(), { once: true });
}

// ─── State renderers ──────────────────────────────────────────────────────────

function renderDefault(banner) {
  banner.classList.remove('acc-push-banner--success', 'acc-push-banner--error', 'acc-push-banner--blocked');
  banner.innerHTML = `
    <span class="acc-push-banner__icon">${BELL_ICON}</span>
    <span class="acc-push-banner__text">
      <strong>Stay in the loop</strong>
      Get instant updates on orders, offers &amp; more — right in your browser.
    </span>
    <span class="acc-push-banner__actions">
      <button class="acc-push-banner__btn acc-push-banner__btn--allow" id="enable-beta-web-notifications">
        ${BELL_ICON} Allow notifications
      </button>
      <button class="acc-push-banner__btn acc-push-banner__btn--dismiss" id="acc-push-dismiss">
        Not now
      </button>
    </span>`;
}

/**
 * Render an informational banner when the browser has blocked notifications.
 * The native permission prompt CANNOT be shown programmatically once denied,
 * so we guide the user to re-enable it manually.
 */
function renderBlocked(banner) {
  banner.classList.add('acc-push-banner--blocked');

  // Detect browser to give the most accurate instruction
  const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg|OPR/.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

  let instruction = 'Click the 🔒 lock icon in the address bar → Notifications → Allow.';
  if (isFirefox) instruction = 'Click the 🔒 lock icon → Connection secure → More information → Permissions → Allow Notifications.';
  if (isSafari) instruction = 'Go to Safari → Settings for this Website → Notifications → Allow.';
  if (isChrome) instruction = 'Click the 🔒 lock icon in the address bar → Site settings → Notifications → Allow.';

  banner.innerHTML = `
    <span class="acc-push-banner__icon">${WARN_ICON}</span>
    <span class="acc-push-banner__text">
      <strong>Notifications are blocked</strong>
      To receive updates, please enable notifications for this site.
      <small>${instruction}</small>
    </span>
    <span class="acc-push-banner__actions">
      <button class="acc-push-banner__btn acc-push-banner__btn--dismiss" id="acc-push-dismiss">
        Dismiss
      </button>
    </span>`;
}

function renderLoading(banner) {
  const allowBtn = banner.querySelector('#enable-beta-web-notifications');
  const dismissBtn = banner.querySelector('#acc-push-dismiss');
  if (allowBtn) {
    allowBtn.disabled = true;
    allowBtn.innerHTML = `<span class="acc-push-spinner"></span> Subscribing…`;
  }
  if (dismissBtn) dismissBtn.disabled = true;
}

function renderSuccess(banner) {
  banner.classList.remove('acc-push-banner--error', 'acc-push-banner--blocked');
  banner.classList.add('acc-push-banner--success');
  banner.innerHTML = `
    <span class="acc-push-banner__icon">${CHECK_ICON}</span>
    <span class="acc-push-banner__text">
      <strong>You're subscribed!</strong>
      You'll now receive browser notifications from us.
    </span>`;
}

function renderError(banner, retryFn) {
  banner.classList.remove('acc-push-banner--success', 'acc-push-banner--blocked');
  banner.classList.add('acc-push-banner--error');
  banner.innerHTML = `
    <span class="acc-push-banner__icon">${WARN_ICON}</span>
    <span class="acc-push-banner__text">
      <strong>Something went wrong</strong>
      We couldn't subscribe you. Please try again.
    </span>
    <span class="acc-push-banner__actions">
      <button class="acc-push-banner__btn acc-push-banner__btn--allow" id="acc-push-retry">
        Retry
      </button>
      <button class="acc-push-banner__btn acc-push-banner__btn--dismiss" id="acc-push-dismiss">
        Dismiss
      </button>
    </span>`;

  banner.querySelector('#acc-push-retry').addEventListener('click', retryFn);
  banner.querySelector('#acc-push-dismiss').addEventListener('click', () => {
    markDismissed();
    hideBanner(banner);
  });
}

// ─── Subscribe handler ────────────────────────────────────────────────────────

async function handleAllow(banner) {
  renderLoading(banner);

  try {
    const { status, subscription } = await initWebPush({ immediate: true });

    if (status === 'granted' && subscription) {
      renderSuccess(banner);
      markDismissed();
      setTimeout(() => hideBanner(banner), 3000);
    } else if (status === 'denied') {
      // User denied in the native dialog — switch to the "blocked" informational view
      renderBlocked(banner);
      banner.querySelector('#acc-push-dismiss').addEventListener('click', () => {
        markDismissed();
        hideBanner(banner);
      }, { once: true });
    } else {
      // User dismissed the native dialog without deciding — let them try again
      renderDefault(banner);
      attachButtonListeners(banner); // eslint-disable-line no-use-before-define
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[PushBanner] Subscription error:', err);
    renderError(banner, () => handleAllow(banner));
  }
}

function attachButtonListeners(banner) {
  const allowBtn = banner.querySelector('#enable-beta-web-notifications');
  const dismissBtn = banner.querySelector('#acc-push-dismiss');

  if (allowBtn) allowBtn.addEventListener('click', () => handleAllow(banner), { once: true });
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      markDismissed();
      hideBanner(banner);
    }, { once: true });
  }
}

// ─── Banner factory ───────────────────────────────────────────────────────────

function createBanner() {
  // Don't create duplicate
  if (document.getElementById(BANNER_ID)) return document.getElementById(BANNER_ID);

  injectStyles();

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Push notification permission');
  document.body.prepend(banner);
  return banner;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Show the push permission banner.
 *
 * Handles all three permission states:
 *  • 'default' → "Allow / Not now" banner
 *  • 'denied'  → "Notifications blocked – here's how to re-enable" banner
 *                (only shown once per session; dismissible)
 *  • 'granted' → SW registered silently, no banner shown
 */
export function showPushBanner() {
  // Feature check — Push API not available (e.g. HTTP, old browser)
  if (
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return;
  }

  const { permission } = Notification;

  // ── Already granted ────────────────────────────────────────────────────────
  if (permission === 'granted') {
    // Silently ensure the SW + subscription are up-to-date
    initWebPush({ immediate: true });
    return;
  }

  // ── Blocked by browser ─────────────────────────────────────────────────────
  if (permission === 'denied') {
    // Show a helpful "how to re-enable" banner (once per session)
    // Use a session-scoped key so it appears again on every new tab/session
    const sessionKey = 'acc_push_blocked_shown';
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');

    const banner = createBanner();
    renderBlocked(banner);

    const dismissBtn = banner.querySelector('#acc-push-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => hideBanner(banner), { once: true });
    }

    showBanner(banner);
    return;
  }

  // ── Default (permission = 'default') ──────────────────────────────────────
  // isDismissed() will auto-clear stale localStorage flags when permission
  // is 'default', so this is always accurate after a browser settings reset.
  if (isDismissed()) return;

  const banner = createBanner();
  renderDefault(banner);
  attachButtonListeners(banner);
  showBanner(banner);
}
