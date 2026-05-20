// add delayed functionality here

/**
 * Web Push — loaded 3 s after page load (via scripts.js → loadDelayed)
 * so it never blocks the critical rendering path.
 *
 * showPushBanner(uid) injects a sticky bar at the top of the page with
 * "Allow notifications" and "Not now" buttons, scoped per account.
 *
 * The banner is only shown when a user is logged in so that:
 *  - Each account gets its own permission prompt
 *  - Logging in as a different user will show the banner again for that account
 *  - When the user allows push, a success notification banner is displayed
 */
import { showPushBanner } from './push-banner.js';
import { getAuthCookie } from '../blocks/auth-modal/auth-modal.js';

/**
 * Extract the Firebase UID from the auth cookie (if logged in).
 * @returns {string|null}
 */
function getCurrentUid() {
  const cookie = getAuthCookie();
  return cookie && cookie.uid ? cookie.uid : null;
}

// ── Show banner for the current session's logged-in user ─────────────────────
const uid = getCurrentUid();
showPushBanner(uid);

// ── React to login / logout happening on the same tab ────────────────────────
// auth-modal.js fires this custom event whenever sign-in or sign-out occurs.
window.addEventListener('authStateChanged', (e) => {
  const user = e.detail && e.detail.user;
  if (user && user.uid) {
    // A user just signed in — show the push banner for their account
    showPushBanner(user.uid);
  }
  // On sign-out (user === null) we do nothing: the banner was already shown
  // (or dismissed) for the previous account and should not reappear.
});
