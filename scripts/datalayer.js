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
 *    cart:  { cartId: '', items: [] },
 *    orderConfirmation: {},                        // populated on order-confirmation page
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

import { KAFKA_REST_PROXY_BASE, KAFKA_CART_TOPIC } from './config.js';

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
  orderConfirmation: {},
  events: [],
};

// ── Internal cartId state ────────────────────────────────────────────────────
// cartId is generated when the first item is added to cart and persisted in
// sessionStorage. It is mirrored on digitalData.cart.cartId for visibility,
// and also appears in digitalData.orderConfirmation once the order is placed.
let _cartId = '';

// ── sessionStorage helpers ────────────────────────────────────────────────────

function saveCartToSession() {
  try {
    sessionStorage.setItem('digitalData_cartItems', JSON.stringify(window.digitalData.cart.items));
    sessionStorage.setItem('digitalData_cartId', window.digitalData.cart.cartId || '');
  } catch (e) { /* quota exceeded – silently ignore */ }
}

function saveOrderConfirmationToSession(data) {
  try {
    sessionStorage.setItem('digitalData_orderConfirmation', JSON.stringify(data));
  } catch (e) { /* quota exceeded – silently ignore */ }
}

// ── Kafka helpers ─────────────────────────────────────────────────────────────

/** Full REST Proxy endpoint for cart events */
const KAFKA_CART_REST_PROXY_URL = `${KAFKA_REST_PROXY_BASE}/topics/${KAFKA_CART_TOPIC}`;

/**
 * Build and publish an ADD_TO_CART event to Kafka via the AWS API Gateway
 * REST Proxy. Mirrors the same pattern used for BETA_COMMERCE_USER_SIGNUP.
 *
 * @param {object} cartItem   – the item that was just added / updated
 * @param {string} cartId     – current cart ID
 * @param {Array}  cartItems  – full cart items array at the time of the event
 */
async function publishCartEventToKafka(cartItem, cartId, cartItems) {
  const { user } = window.digitalData;

  const eventPayload = {
    eventType: 'ADD_TO_CART',
    timestamp: new Date().toISOString(),
    _id: crypto.randomUUID(),
    SOURCE: 'BETA_COMMERCE',
    customer: {
      customerId: user.customerId || '',
      email: user.email || '',
      authenticated: user.authenticated || 'unauthenticated',
    },
    cart: {
      cartId,
      totalItems: cartItems.length,
      totalQuantity: cartItems.reduce((sum, i) => sum + (i.quantity || 1), 0),
      currency: 'INR',
      items: cartItems.map((i) => ({
        sku: i.sku,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        category: i.category,
        image: i.image,
      })),
    },
    product: {
      sku: cartItem.sku,
      name: cartItem.name,
      price: cartItem.price,
      quantity: cartItem.quantity,
      category: cartItem.category,
      image: cartItem.image,
    },
  };

  const kafkaEnvelope = {
    records: [{ value: eventPayload }],
  };

  console.group('[digitalData] 🚀 Publishing ADD_TO_CART event to Kafka');
  console.log('Topic   :', KAFKA_CART_TOPIC);
  console.log('Endpoint:', KAFKA_CART_REST_PROXY_URL);
  console.log('Payload :', JSON.stringify(eventPayload, null, 2));
  console.groupEnd();

  try {
    const response = await fetch(KAFKA_CART_REST_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.kafka.json.v2+json',
        Accept: 'application/vnd.kafka.v2+json',
      },
      body: JSON.stringify(kafkaEnvelope),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[digitalData] ❌ Kafka cart publish failed — HTTP ${response.status}:`,
        errorText,
      );
      return;
    }

    const result = await response.json().catch(() => ({}));
    console.group('[digitalData] ✅ Kafka cart publish succeeded');
    console.log('HTTP Status :', response.status);
    console.log('Response    :', result);
    console.log('Event sent  :', JSON.stringify(eventPayload, null, 2));
    console.groupEnd();
  } catch (networkErr) {
    console.error('[digitalData] ❌ Kafka cart publish – network error:', networkErr);
  }
}

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
  if (!_cartId) {
    const storedCartId = sessionStorage.getItem('digitalData_cartId');
    if (storedCartId) {
      _cartId = storedCartId;
    } else {
      const newCartId = `CART-${crypto.randomUUID()}`;
      _cartId = newCartId;
      sessionStorage.setItem('digitalData_cartId', newCartId);
      console.log('[digitalData] 🆕 New cartId generated:', newCartId);
    }
  }

  // Keep cartId visible on the cart object
  window.digitalData.cart.cartId = _cartId;

  // Check if an item with the same SKU already exists – if so, increment quantity
  const existingItem = window.digitalData.cart.items.find((i) => i.sku && i.sku === (item.sku || ''));

  let cartItem;
  if (existingItem) {
    existingItem.quantity += (item.quantity || 1);
    existingItem.addedAt = new Date().toISOString();
    cartItem = existingItem;
  } else {
    cartItem = {
      name: item.name || 'Unknown Product',
      sku: item.sku || '',
      price: item.price || '0.00',
      image: item.image || '',
      category: item.category || '',
      quantity: item.quantity || 1,
      addedAt: new Date().toISOString(),
    };
    window.digitalData.cart.items.push(cartItem);
  }

  saveCartToSession();

  const eventObj = {
    eventId: crypto.randomUUID(),
    eventType: 'ADD_TO_CART',
    source: 'BETA_COMMERCE',
    product: { ...cartItem },
    cart: {
      cartId: _cartId,
      totalItems: window.digitalData.cart.items.length,
      items: [...window.digitalData.cart.items],
    },
    user: { ...window.digitalData.user },
  };

  pushEvent(eventObj);

  // Publish to Kafka (non-blocking)
  publishCartEventToKafka(cartItem, _cartId, [...window.digitalData.cart.items]);

  console.group('[digitalData] 🛒 Add-to-Cart');
  console.table(cartItem);
  console.log('Cart ID:', _cartId);
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
  const clearedCartId = _cartId;

  window.digitalData.cart.items = [];
  window.digitalData.cart.cartId = '';
  _cartId = '';
  sessionStorage.removeItem('digitalData_cartId');
  sessionStorage.removeItem('digitalData_cartItems');

  const eventObj = {
    eventId: crypto.randomUUID(),
    eventType: 'CART_CLEAR',
    source: 'BETA_COMMERCE',
    clearedItems,
    cart: {
      clearedCartId,
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
  // cartId: prefer value passed in orderData, otherwise use the module-level
  // _cartId that was generated when items were added to cart.
  const resolvedCartId = orderData.cartId || _cartId || sessionStorage.getItem('digitalData_cartId') || '';

  const orderConfirmation = {
    orderId: orderData.orderId || '',
    cartId: resolvedCartId,
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
      cardType: orderData.paymentData ? (orderData.paymentData.cardType || '') : '',
      status: 'SUCCESS',
    },
    paymentStatus: 'SUCCESS',
  };

  // Populate the persistent orderConfirmation node on digitalData and sessionStorage
  window.digitalData.orderConfirmation = { ...orderConfirmation };
  saveOrderConfirmationToSession(orderConfirmation);

  const eventObj = {
    eventId: crypto.randomUUID(),
    eventType: 'ORDER_CONFIRMATION',
    source: 'BETA_COMMERCE',
    orderConfirmation,
    user: { ...window.digitalData.user },
  };

  pushEvent(eventObj);

  console.group('[digitalData] ✅ Order Confirmation');
  console.log('Order ID      :', orderConfirmation.orderId);
  console.log('Cart ID       :', orderConfirmation.cartId);
  console.log('Total         :', orderConfirmation.currency, orderConfirmation.total);
  console.log('Payment Method:', orderConfirmation.payment.method);
  console.log('Last 4        :', orderConfirmation.payment.last4);
  console.log('Payment Status:', orderConfirmation.paymentStatus);
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

// ── Hydrate cart and orderConfirmation from sessionStorage on page load ───────
/**
 * Restore cartId, cart.items, and orderConfirmation from sessionStorage so
 * that all state persists across page navigations.
 * cartId is mirrored on digitalData.cart.cartId and also appears in
 * digitalData.orderConfirmation once the order is placed.
 */
(function hydrateFromSession() {
  // Restore cartId
  const storedCartId = sessionStorage.getItem('digitalData_cartId');
  if (storedCartId) {
    _cartId = storedCartId;
    window.digitalData.cart.cartId = storedCartId;
    console.log('[digitalData] 🛒 CartId restored from sessionStorage:', storedCartId);
  }

  // Restore cart items
  try {
    const storedItems = sessionStorage.getItem('digitalData_cartItems');
    if (storedItems) {
      const parsed = JSON.parse(storedItems);
      if (Array.isArray(parsed) && parsed.length > 0) {
        window.digitalData.cart.items = parsed;
        console.log('[digitalData] 🛒 Cart items restored from sessionStorage:', parsed.length, 'item(s)');
      }
    }
  } catch (e) {
    console.warn('[digitalData] Failed to restore cart items from sessionStorage:', e);
  }

  // Restore orderConfirmation
  try {
    const storedOrder = sessionStorage.getItem('digitalData_orderConfirmation');
    if (storedOrder) {
      const parsed = JSON.parse(storedOrder);
      if (parsed && parsed.orderId) {
        window.digitalData.orderConfirmation = parsed;
        console.log('[digitalData] ✅ orderConfirmation restored from sessionStorage:', parsed.orderId);
      }
    }
  } catch (e) {
    console.warn('[digitalData] Failed to restore orderConfirmation from sessionStorage:', e);
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
