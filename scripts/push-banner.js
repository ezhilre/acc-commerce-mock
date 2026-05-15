/**
 * Push Permission Banner
 *
 * Injects a sticky bar at the very top of the page (above the site header)
 * that asks the visitor whether they want to receive push notifications.
 *
 * States:
 *  – Hidden      : permission already 'granted' or 'denied', or user dismissed
 *  – Visible     : first visit, permission is still 'default'
 *  – Loading     : user clicked "Allow" — spinner shown while subscribing
 *  – Success     : subscription confirmed — banner auto-dismisses after 3 s
 *  – Error       : something went wrong — friendly message + retry option
 *
 * The banner respects the user's choice by storing a flag in localStorage so
 * it is never shown again after an explicit "Not now" or "Allow".
 */

import { initWebPush } from './webpush.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const DISMISSED_KEY = 'acc_push_banner_dismissed';
const BANNER_ID = 'acc-push-banner';

// Bell SVG icon (inline, no external dependency)
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

/* Error state */
#${BANNER_ID}.acc-push-banner--error {
  background: #7a1a1a;
}

/* Offset body so the banner doesn't overlap content */
body.acc-push-banner-open {
  padding-top: 54px;
  transition: padding-top .3s ease;
}

@media (max-width: 480px) {
  #${BANNER_ID} {
    flex-wrap: wrap;
  }

  #${BANNER_ID} .acc-push-banner__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDismissed() {
  try {
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

function injectStyles() {
  if (document.getElementById('acc-push-banner-styles')) return;
  const style = document.createElement('style');
  style.id = 'acc-push-banner-styles';
  style.textContent = BANNER_CSS;
  document.head.appendChild(style);
}

// ─── Banner DOM helpers ───────────────────────────────────────────────────────

function getBanner() {
  return document.getElementById(BANNER_ID);
}

function showBanner(banner) {
  document.body.classList.add('acc-push-banner-open');
  // Trigger CSS transition on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => banner.classList.add('acc-push-banner--visible'));
  });
}

function hideBanner(banner) {
  banner.classList.remove('acc-push-banner--visible');
  document.body.classList.remove('acc-push-banner-open');
  // Remove from DOM after transition
  banner.addEventListener('transitionend', () => banner.remove(), { once: true });
}

// ─── State renderers ──────────────────────────────────────────────────────────

function renderDefault(banner) {
  banner.classList.remove('acc-push-banner--success', 'acc-push-banner--error');
  banner.innerHTML = `
    <span class="acc-push-banner__icon">${BELL_ICON}</span>
    <span class="acc-push-banner__text">
      <strong>Stay in the loop</strong>
      Get instant updates on orders, offers &amp; more — right in your browser.
    </span>
    <span class="acc-push-banner__actions">
      <button class="acc-push-banner__btn acc-push-banner__btn--allow" id="acc-push-allow">
        ${BELL_ICON} Allow notifications
      </button>
      <button class="acc-push-banner__btn acc-push-banner__btn--dismiss" id="acc-push-dismiss">
        Not now
      </button>
    </span>`;
}

function renderLoading(banner) {
  const allowBtn = banner.querySelector('#acc-push-allow');
  const dismissBtn = banner.querySelector('#acc-push-dismiss');
  if (allowBtn) {
    allowBtn.disabled = true;
    allowBtn.innerHTML = `<span class="acc-push-spinner"></span> Subscribing…`;
  }
  if (dismissBtn) dismissBtn.disabled = true;
}

function renderSuccess(banner) {
  banner.classList.add('acc-push-banner--success');
  banner.innerHTML = `
    <span class="acc-push-banner__icon">${CHECK_ICON}</span>
    <span class="acc-push-banner__text">
      <strong>You're subscribed!</strong>
      You'll now receive browser notifications from us.
    </span>`;
}

function renderError(banner, retryFn) {
  banner.classList.add('acc-push-banner--error');
  banner.innerHTML = `
    <span class="acc-push-banner__icon">${BELL_ICON}</span>
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

// ─── Main subscribe handler ───────────────────────────────────────────────────

async function handleAllow(banner) {
  renderLoading(banner);

  try {
    const { status, subscription } = await initWebPush({ immediate: true });

    if (status === 'granted' && subscription) {
      renderSuccess(banner);
      markDismissed(); // Don't show the banner again
      setTimeout(() => hideBanner(banner), 3000);
    } else if (status === 'denied') {
      // Browser permission dialog was denied — can't do anything more
      markDismissed();
      hideBanner(banner);
    } else {
      // 'default' / user closed the dialog — show again next visit
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
  const allowBtn = banner.querySelector('#acc-push-allow');
  const dismissBtn = banner.querySelector('#acc-push-dismiss');

  if (allowBtn) allowBtn.addEventListener('click', () => handleAllow(banner), { once: true });
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      markDismissed();
      hideBanner(banner);
    }, { once: true });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Render and show the push permission banner at the top of the page.
 *
 * Skips silently if:
 *  – Push is not supported by the browser
 *  – Permission is already 'granted' or 'denied'
 *  – The user previously dismissed the banner
 */
export function showPushBanner() {
  // Feature check
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  // Already decided
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    // If already granted, still initialise the SW silently so the subscription is fresh
    if (Notification.permission === 'granted') {
      initWebPush({ immediate: true });
    }
    return;
  }

  // User previously said "Not now"
  if (isDismissed()) return;

  injectStyles();

  // Build banner
  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Push notification permission request');
  document.body.prepend(banner);

  renderDefault(banner);
  attachButtonListeners(banner);
  showBanner(banner);
}
