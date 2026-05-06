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
 *  window.digitalData.setUser(userData)            – called after successful login/signup
 *  window.digitalData.clearUser()                  – called after sign-out
 *  window.digitalData.pushAddToCart(item)          – called when Add to Cart is clicked; generates cartId on first call
 *  window.digitalData.clearCart()                  – empties cart and clears cartId from sessionStorage
 *  window.digitalData.pushOrderConfirmation(order) – called on order-confirmation page load
 *  window.digitalData.push(event)                  – generic event push
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
    cartId: '',
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
 * A unique cartId is generated the first time an item is added and persisted
 * in sessionStorage so it survives page navigations within the same session.
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
  // ── Generate / restore cartId ──────────────────────────────────────────────
  if (!window.digitalData.cart.cartId) {
    const storedCartId = sessionStorage.getItem('digitalData_cartId');
    if (storedCartId) {
      window.digitalData.cart.cartId = storedCartId;
    } else {
      const newCartId = `CART-${crypto.randomUUID()}`;
      window.digitalData.cart.cartId = newCartId;
      sessionStorage.setItem('digitalData_cartId', newCartId);
      console.log('[digitalData] 🆕 New cartId generated:', newCartId);
    }
  }

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
      cartId: window.digitalData.cart.cartId,
      totalItems: window.digitalData.cart.items.length,
      items: [...window.digitalData.cart.items],
    },
    user: { ...window.digitalData.user },
  };

  pushEvent(eventObj);

  console.group('[digitalData] 🛒 Add-to-Cart');
  console.table(cartItem);
  console.log('Cart ID:', window.digitalData.cart.cartId);
  console.log('Cart total items:', window.digitalData.cart.items.length);
  console.groupEnd();
}

// ── Cart clear helper ─────────────────────────────────────────────────────────

/**
 * Empty digitalData.cart.items and push a CART_CLEAR event.
 * Called directly or via the 'clearCart' CustomEvent.
 */
function clearCart() {
  const clearedItems = [...window.digitalData.cart.items];
  const clearedCartId = window.digitalData.cart.cartId;

  window.digitalData.cart.items = [];
  window.digitalData.cart.cartId = '';
  sessionStorage.removeItem('digitalData_cartId');

  const eventObj = {
    eventId: crypto.randomUUID(),
    eventType: 'CART_CLEAR',
    source: 'BETA_COMMERCE',
    clearedItems,
    cart: {
      cartId: clearedCartId,
      totalItems: 0,
      items: [],
    },
    user: { ...window.digitalData.user },
  };

  pushEvent(eventObj);

  console.log('[digitalData] 🗑️ Cart cleared. Items removed:', clearedItems.length);
}

// ── Order confirmation helper ─────────────────────────────────────────────────

/**
 * Push an ORDER_CONFIRMATION event to the datalayer.
 * Called from the order-confirmation block after a successful payment.
 *
 * @param {object} orderData
 * @param {string}  orderData.orderId           – unique order identifier
 * @param {string}  [orderData.cartId]          – cart ID that was converted
 * @param {string}  [orderData.date]            – ISO timestamp of the order
 * @param {Array}   [orderData.items]           – ordered items array
 * @param {string}  [orderData.total]           – order total string
 * @param {string}  [orderData.currency]        – currency code (default: INR)
 * @param {object}  [orderData.billingAddress]  – billing address object
 * @param {object}  [orderData.shippingAddress] – shipping address object
 * @param {object}  [orderData.paymentData]     – payment method summary
 */
function pushOrderConfirmation(orderData) {
  const eventObj = {
    eventId: crypto.randomUUID(),
    eventType: 'ORDER_CONFIRMATION',
    source: 'BETA_COMMERCE',
    paymentStatus: 'SUCCESS',
    order: {
      orderId: orderData.orderId || '',
      cartId: orderData.cartId || '',
      date: orderData.date || new Date().toISOString(),
      total: orderData.total || '0.00',
      currency: orderData.currency || 'INR',
      itemCount: (orderData.items || []).length,
      items: orderData.items || [],
      billingAddress: orderData.billingAddress || {},
      shippingAddress: orderData.shippingAddress || {},
      payment: {
        method: orderData.paymentData ? orderData.paymentData.method : 'credit-card',
        last4: orderData.paymentData ? orderData.paymentData.last4 : '',
        status: 'SUCCESS',
      },
    },
    user: { ...window.digitalData.user },
  };

  pushEvent(eventObj);

  console.group('[digitalData] ✅ Order Confirmation');
  console.log('Order ID:', orderData.orderId);
  console.log('Cart ID :', orderData.cartId);
  console.log('Payment Status: SUCCESS');
  console.table(orderData.items || []);
  console.groupEnd();
}

// ── Attach public API ─────────────────────────────────────────────────────────

window.digitalData.setUser = setUser;
window.digitalData.clearUser = clearUser;
window.digitalData.pushAddToCart = pushAddToCart;
window.digitalData.clearCart = clearCart;
window.digitalData.pushOrderConfirmation = pushOrderConfirmation;
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

/**
 * Any UI component can dispatch:
 *   document.dispatchEvent(new CustomEvent('clearCart', { bubbles: true }))
 * or
 *   window.dispatchEvent(new CustomEvent('clearCart'))
 * and the datalayer will empty the cart and push a CART_CLEAR event.
 */
window.addEventListener('clearCart', () => {
  clearCart();
});

// ── Hydrate cartId from sessionStorage on page load ──────────────────────────
/**
 * Restore cartId from sessionStorage so that cart state persists across
 * page navigations (product page → checkout → order-confirmation).
 */
(function hydrateCartId() {
  const stored = sessionStorage.getItem('digitalData_cartId');
  if (stored) {
    window.digitalData.cart.cartId = stored;
    console.log('[digitalData] 🛒 CartId restored from sessionStorage:', stored);
  }
}());

// ── Hydrate from auth cookie on page load ─────────────────────────────────────
/**
 * Read the auth_user session cookie (written by auth-modal.js on sign-in)
 * and pre-populate the datalayer user node so that the authenticated state
 * is preserved across page loads / new tabs without waiting for Firebase.
 */
(function hydrateFromCookie() {
  try {
    const AUTH_COOKIE_NAME = 'auth_user';
    const match = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));

    if (!match) {
      console.log('[digitalData] No auth cookie found – user is unauthenticated.');
      return;
    }

    const cookieData = JSON.parse(
      decodeURIComponent(match.split('=').slice(1).join('=')),
    );

    if (!cookieData || !cookieData.uid) return;

    // Populate user node from cookie (uid is used as customerId until
    // a full profile is available from Firestore / an authStateChanged event)
    window.digitalData.user = {
      authenticated: 'authenticated',
      customerId: cookieData.uid || '',
      email: cookieData.email || '',
      firstName: '',   // not stored in cookie; will be enriched by authStateChanged
      lastName: '',
      phone: '',
      country: '',
      isEmailVerified: cookieData.emailVerified || false,
      source: 'BETA_COMMERCE',
    };

    console.group('[digitalData] 🍪 User hydrated from auth cookie');
    console.table(window.digitalData.user);
    console.groupEnd();
  } catch (err) {
    console.warn('[digitalData] Cookie hydration failed:', err);
  }
}());

console.log('[digitalData] ✅ Datalayer initialised', window.digitalData);
