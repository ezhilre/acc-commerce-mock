// add delayed functionality here

/**
 * Web Push — loaded 3 s after page load (via scripts.js → loadDelayed)
 * so it never blocks the critical rendering path.
 *
 * showPushBanner() injects a sticky bar at the top of the page with
 * "Allow notifications" and "Not now" buttons.  The browser's native
 * permission dialog is only triggered when the user explicitly clicks
 * "Allow", which means browsers will NOT auto-block the request.
 */
import { showPushBanner } from './push-banner.js';

showPushBanner();
