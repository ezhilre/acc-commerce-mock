/**
 * digitalData Datalayer
 * ─────────────────────
 * Initialises window.digitalData and exposes helper methods to push
 * user-authentication events and add-to-cart events.
 *
 * Structure:
 *  window.digitalData = {
 *    user:  { authenticated, customerId, email, firstName, lastName,
 *             phone, country, isEmailVerified, source },
 *    cart:  { items: [] },
 *    events: []          // append-only event log
 *  }
 *
 * Public API:
 *  window.digitalData.setUser(userData)   – called after successful login/signup
 *  window.digitalData.clearUser()         – called after sign-out
 *  window.digitalData.pushAddToCart(item) – called when Add to Cart is clicked
 *  window.digitalData.push(event)         – generic event push
 */

// ── Initialise the global object ─────────────────────────────────────────────

window.digitalData = window.digitalData || {
  user: {
    authenticated: 'unauthenticated',
    customerId: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    country: '',
    isEmailVerified: false,
    source: '',
  },
  cart: {
    items: [],
  },
  events: [],
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Append an event object to digitalData.events and emit a
 * 'digitalDataPush' CustomEvent on window so that tag managers /
 * analytics scripts can subscribe.
 * @param {object} eventObj
 */
function pushEvent(eventObj) {
  const enriched = {
    ...eventObj,
    timestamp: eventObj.timestamp || new Date().toISOString(),
  };
  window.digitalData.events.push(enriched);
  window.dispatchEvent(
    new CustomEvent('digitalDataPush', { detail: enriched }),
  );
  console.log('[digitalData] event pushed:', JSON.stringify(enriched, null, 2));
}

// ── User helpers ──────────────────────────────────────────────────────────────

/**
 * Populate the user node and push an authentication event.
 *
 * @param {object} userData
 * @param {string}  userData.customerId
 * @param {string}  userData.email
 * @param {string}  userData.firstName
 * @param {string}  userData.lastName
 * @param {string}  [userData.phone]
 * @param {string}  [userData.country]
 * @param {boolean} [userData.isEmailVerified]
 * @param {string}  [userData.source]          – e.g. 'BETA_COMMERCE'
 * @param {string}  [userData.eventId]         – UUID for the auth event
 * @param {string}  [userData.eventType]       – e.g. 'BETA_COMMERCE_USER_SIGNUP' | 'BETA_COMMERCE_USER_LOGIN'
 */
function setUser(userData) {
  window.digitalData.user = {
    authenticated: 'authenticated',
    customerId: userData.customerId || '',
    email: userData.email || '',
    firstName: userData.firstName || '',
    lastName: userData.lastName || '',
    phone: userData.phone || '',
    country: userData.country || '',
    isEmailVerified: userData.isEmailVerified !== undefined ? userData.isEmailVerified : false,
    source: userData.source || 'BETA_COMMERCE',
  };

  pushEvent({
    eventId: userData.eventId || crypto.randomUUID(),
    eventType: userData.eventType || 'BETA_COMMERCE_USER_LOGIN',
    source: userData.source || 'BETA_COMMERCE',
    user: { ...window.digitalData.user },
  });

  console.group('[digitalData] 👤 User authenticated');
  console.table(window.digitalData.user);
  console.groupEnd();
}

/**
 * Clear the user node and push an unauthentication event.
 */
function clearUser() {
  window.digitalData.user = {
    authenticated: 'unauthenticated',
    customerId: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    country: '',
    isEmailVerified: false,
    source: '',
  };

  pushEvent({
    eventId: crypto.randomUUID(),
    eventType: 'BETA_COMMERCE_USER_LOGOUT',
    source: 'BETA_COMMERCE',
    user: { ...window.digitalData.user },
  });

  console.log('[digitalData] 🔓 User unauthenticated');
}

// ── Cart helpers ──────────────────────────────────────────────────────────────

/**
 * Push an add-to-cart event and append the item to digitalData.cart.items.
 *
 * @param {object} item
 * @param {string}  item.name        – product name
 * @param {string}  item.sku         – product SKU
 * @param {string}  item.price       – formatted price string (e.g. "1999.00")
 * @param {string}  [item.image]     – product image URL
 * @param {string}  [item.category]  – product category
 * @param {number}  [item.quantity]  – defaults to 1
 */
function pushAddToCart(item) {
  const cartItem = {
    name: item.name || 'Unknown Product',
    sku: item.sku || '',
    price: item.price || '0.00',
    image: item.image || '',
    category: item.category || '',
    quantity: item.quantity || 1,
    addedAt: new Date().toISOString(),
  };

  window.digitalData.cart.items.push(cartItem);

  const eventObj = {
    eventId: crypto.randomUUID(),
    eventType: 'ADD_TO_CART',
    source: 'BETA_COMMERCE',
    product: { ...cartItem },
    cart: {
      totalItems: window.digitalData.cart.items.length,
      items: [...window.digitalData.cart.items],
    },
    user: { ...window.digitalData.user },
  };

  pushEvent(eventObj);

  console.group('[digitalData] 🛒 Add-to-Cart');
  console.table(cartItem);
  console.log(
    'Cart total items:',
    window.digitalData.cart.items.length,
  );
  console.groupEnd();
}

// ── Attach public API ─────────────────────────────────────────────────────────

window.digitalData.setUser = setUser;
window.digitalData.clearUser = clearUser;
window.digitalData.pushAddToCart = pushAddToCart;
window.digitalData.push = pushEvent;

// ── Listen for global events from other blocks ────────────────────────────────

/**
 * auth-modal dispatches 'authStateChanged' with { user } after sign-in
 * and with { user: null } after sign-out.
 * We intercept those here so the datalayer stays in sync regardless of
 * how sign-in/out is triggered.
 */
window.addEventListener('authStateChanged', (e) => {
  const { user } = e.detail || {};
  if (user) {
    // Firebase user object – enrich with Firestore profile if available later
    setUser({
      customerId: user.uid || '',
      email: user.email || '',
      firstName: user.displayName ? user.displayName.split(' ')[0] : '',
      lastName: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : '',
      phone: user.phoneNumber || '',
      country: '',
      isEmailVerified: user.emailVerified || false,
      source: 'BETA_COMMERCE',
      eventId: crypto.randomUUID(),
      eventType: 'BETA_COMMERCE_USER_LOGIN',
    });
  } else {
    clearUser();
  }
});

// NOTE: The 'addToCart' CustomEvent listener is intentionally omitted here.
// product-card.js calls window.digitalData.pushAddToCart() directly before
// dispatching the event, so listening here would cause a duplicate entry.

console.log('[digitalData] ✅ Datalayer initialised', window.digitalData);
