/**
 * digitalData Datalayer
 * ─────────────────────
 * Initialises window.digitalData and exposes helper methods to push
 * user-authentication events and add-to-cart events.
 *
 * Structure:
 *  window.digitalData = {
 *    user:  { authenticated, customerId, email, firstName, lastName,
 *             phone, gender, interests, dob, country, isEmailVerified, source },
 *    cart:  { betacartId: '', citems: [] },
 *    orderConfirmation: {},                        // populated on order-confirmation page
 *    events: []          // append-only event log
 *  }
 *
 * Public API:
 *  window.digitalData.setUser(userData)            – called after successful login/signup
 *  window.digitalData.clearUser()                  – called after sign-out
 *  window.digitalData.pushAddToCart(item)          – called when Add to Cart is clicked; generates betacartId on first call
 *  window.digitalData.clearCart()                  – empties cart and clears betacartId from sessionStorage
 *  window.digitalData.pushOrderConfirmation(order) – called on order-confirmation page load
 *  window.digitalData.push(event)                  – generic event push
 */

import { KAFKA_REST_PROXY_BASE, KAFKA_CART_TOPIC, KAFKA_ORDER_TOPIC } from './config.js';

// ── Initialise the global object ─────────────────────────────────────────────

window.digitalData = window.digitalData || {
  user: {
    authenticated: 'unauthenticated',
    customerId: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    gender: '',
    interests: [],
    dob: '',
    country: '',
    isEmailVerified: false,
    source: '',
  },
  cart: {
    betacartId: '',
    citems: [],
  },
  orderConfirmation: {},
  events: [],
};

// ── Internal betacartId state ────────────────────────────────────────────────────
// betacartId is generated when the first item is added to cart and persisted in
// sessionStorage. It is mirrored on digitalData.cart.betacartId for visibility,
// and also appears in digitalData.orderConfirmation once the order is placed.
let _cartId = '';

// ── sessionStorage helpers ────────────────────────────────────────────────────

function saveCartToSession() {
  try {
    sessionStorage.setItem('digitalData_cartItems', JSON.stringify(window.digitalData.cart.citems));
    sessionStorage.setItem('digitalData_cartId', window.digitalData.cart.betacartId || '');
  } catch (e) { /* quota exceeded – silently ignore */ }
}

function saveOrderConfirmationToSession(data) {
  try {
    sessionStorage.setItem('digitalData_orderConfirmation', JSON.stringify(data));
  } catch (e) { /* quota exceeded – silently ignore */ }
}

function saveUserProfileToSession(user) {
  try {
    sessionStorage.setItem('digitalData_userProfile', JSON.stringify({
      phone: user.phone || '',
      gender: user.gender || '',
      interests: Array.isArray(user.interests) ? user.interests : [],
      dob: user.dob || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      country: user.country || '',
    }));
  } catch (e) { /* quota exceeded – silently ignore */ }
}

function getUserProfileFromSession() {
  try {
    const raw = sessionStorage.getItem('digitalData_userProfile');
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

function clearUserProfileFromSession() {
  try {
    sessionStorage.removeItem('digitalData_userProfile');
  } catch (e) { /* ignore */ }
}

// ── Kafka helpers ─────────────────────────────────────────────────────────────

/** Full REST Proxy endpoint for cart events */
const KAFKA_CART_REST_PROXY_URL = `${KAFKA_REST_PROXY_BASE}/topics/${KAFKA_CART_TOPIC}`;

/**
 * Build and publish an ADD_TO_CART event to Kafka via the AWS API Gateway
 * REST Proxy. Mirrors the same pattern used for BETA_COMMERCE_USER_SIGNUP.
 *
 * @param {object} cartItem   – the item that was just added / updated
 * @param {string} betacartId     – current cart ID
 * @param {Array}  cartItems  – full cart items array at the time of the event
 */
async function publishCartEventToKafka(cartItem, betacartId, cartItems) {
  const { user } = window.digitalData;

  // If the live user node is still unauthenticated (e.g. datalayer not yet
  // hydrated from cookie), fall back to reading the auth cookie directly so
  // that customerId and email are never empty when the user IS signed in.
  const isLiveUserAuthenticated = user && user.authenticated === 'authenticated' && (user.customerId || user.email);
  let resolvedUser = user || {};
  if (!isLiveUserAuthenticated) {
    try {
      const AUTH_COOKIE_NAME = 'auth_user';
      const match = document.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
      if (match) {
        const cookieData = JSON.parse(decodeURIComponent(match.split('=').slice(1).join('=')));
        if (cookieData && cookieData.uid) {
          resolvedUser = {
            customerId: cookieData.uid || '',
            email: cookieData.email || '',
            authenticated: 'authenticated',
          };
        }
      }
    } catch (e) { /* ignore cookie read errors */ }
  }

  const cartEventId = crypto.randomUUID();

  const eventPayload = {
    eventType: 'ADD_TO_CART',
    timestamp: new Date().toISOString(),
    _id: crypto.randomUUID(),
    eventId: cartEventId,
    SOURCE: 'BETA_COMMERCE',
    customerId: resolvedUser.customerId || '',
    email: resolvedUser.email || '',
    customer: {
      customerId: resolvedUser.customerId || '',
      email: resolvedUser.email || '',
      authenticated: resolvedUser.authenticated || 'unauthenticated',
    },
    cart: {
      betacartId,
      totalItems: cartItems.length,
      totalQuantity: cartItems.reduce((sum, i) => sum + (i.quantity || 1), 0),
      currency: 'INR',
      citems: cartItems.map((i) => ({
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
    records: [{ key: resolvedUser.customerId || betacartId || cartEventId, value: eventPayload }],
  };

  console.group('[digitalData] 🚀 Publishing ADD_TO_CART event to Kafka');
  console.log('Topic      :', KAFKA_CART_TOPIC);
  console.log('Endpoint   :', KAFKA_CART_REST_PROXY_URL);
  console.log('eventId    :', cartEventId);
  console.log('customerId :', resolvedUser.customerId || '(unauthenticated)');
  console.log('email      :', resolvedUser.email || '(unauthenticated)');
  console.log('Payload    :', JSON.stringify(eventPayload, null, 2));
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

/** Full REST Proxy endpoint for order confirmation events */
const KAFKA_ORDER_REST_PROXY_URL = `${KAFKA_REST_PROXY_BASE}/topics/${KAFKA_ORDER_TOPIC}`;

/**
 * Build and publish an ORDER_CONFIRMATION event to Kafka via the AWS API Gateway
 * REST Proxy. Mirrors the same pattern used for ADD_TO_CART and BETA_COMMERCE_USER_SIGNUP.
 *
 * @param {object} orderConfirmation  – the fully-resolved orderConfirmation object
 */
async function publishOrderEventToKafka(orderConfirmation) {
  const { user } = window.digitalData;

  // If the live user node is still unauthenticated (Firebase hasn't re-hydrated yet
  // after the page navigation), fall back to the customer snapshot that was captured
  // at checkout time and stored alongside the order in localStorage.
  const isLiveUserAuthenticated = user && user.authenticated === 'authenticated' && (user.customerId || user.email);
  const savedCustomer = orderConfirmation.customer || {};
  const resolvedCustomer = {
    customerId: isLiveUserAuthenticated ? (user.customerId || '') : (savedCustomer.customerId || ''),
    email: isLiveUserAuthenticated ? (user.email || '') : (savedCustomer.email || ''),
    authenticated: isLiveUserAuthenticated ? (user.authenticated || 'unauthenticated') : (savedCustomer.authenticated || 'unauthenticated'),
  };

  const orderEventId = crypto.randomUUID();
  const eventPayload = {
    eventType: 'ORDER_CONFIRMATION',
    timestamp: new Date().toISOString(),
    _id: crypto.randomUUID(),
    eventId: orderEventId,
    SOURCE: 'BETA_COMMERCE',
    customerId: resolvedCustomer.customerId || '',
    email: resolvedCustomer.email || '',
    customer: resolvedCustomer,
    order: {
      orderId: orderConfirmation.orderId || '',
      betacartId: orderConfirmation.betacartId || '',
      date: orderConfirmation.date || new Date().toISOString(),
      total: parseFloat(orderConfirmation.total) || 0,
      currency: orderConfirmation.currency || 'INR',
      itemCount: orderConfirmation.itemCount || 0,
      totalQuantity: (orderConfirmation.citems || []).reduce((sum, i) => sum + (i.quantity || 1), 0),
      paymentStatus: orderConfirmation.paymentStatus || 'SUCCESS',
      payment: {
        method: orderConfirmation.payment ? orderConfirmation.payment.method : 'credit-card',
        last4: orderConfirmation.payment ? orderConfirmation.payment.last4 : '',
        cardType: orderConfirmation.payment ? (orderConfirmation.payment.cardType || '') : '',
        status: orderConfirmation.payment ? (orderConfirmation.payment.status || 'SUCCESS') : 'SUCCESS',
      },
      billingAddress: orderConfirmation.billingAddress || {},
      shippingAddress: orderConfirmation.shippingAddress || {},
      citems: (orderConfirmation.citems || []).map((i) => ({
        sku: i.sku,
        name: i.name,
        price: parseFloat(i.price) || 0,
        quantity: i.quantity,
        category: i.category,
        image: i.image,
      })),
    },
  };

  console.group('[digitalData] 🚀 Publishing ORDER_CONFIRMATION event to Kafka');
  console.log('Topic      :', KAFKA_ORDER_TOPIC);
  console.log('Endpoint   :', KAFKA_ORDER_REST_PROXY_URL);
  console.log('eventId    :', orderEventId);
  console.log('customerId :', resolvedCustomer.customerId || '(unauthenticated)');
  console.log('email      :', resolvedCustomer.email || '(unauthenticated)');
  console.log('Payload    :', JSON.stringify(eventPayload, null, 2));
  console.groupEnd();

  const kafkaEnvelope = {
    records: [{ key: resolvedCustomer.customerId || orderConfirmation.orderId || orderEventId, value: eventPayload }],
  };

  try {
    const response = await fetch(KAFKA_ORDER_REST_PROXY_URL, {
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
        `[digitalData] ❌ Kafka order publish failed — HTTP ${response.status}:`,
        errorText,
      );
      return;
    }

    const result = await response.json().catch(() => ({}));
    console.group('[digitalData] ✅ Kafka order publish succeeded');
    console.log('HTTP Status :', response.status);
    console.log('Response    :', result);
    console.log('Event sent  :', JSON.stringify(eventPayload, null, 2));
    console.groupEnd();
  } catch (networkErr) {
    console.error('[digitalData] ❌ Kafka order publish – network error:', networkErr);
  }
}

// ── Adobe Data Layer helper ───────────────────────────────────────────────────

/**
 * Returns a Promise that resolves once window.adobeDataLayer is fully
 * initialised by the Adobe Client Data Layer (ACDL) script.
 *
 * The ACDL script replaces the native Array.prototype.push on the
 * adobeDataLayer array with its own handler and fires an
 * 'adobeDataLayer:ready' event on window when it has finished.
 *
 * • If ACDL has already taken over (push !== Array.prototype.push) we
 *   resolve immediately.
 * • Otherwise we wait for the 'adobeDataLayer:ready' CustomEvent with a
 *   3-second safety timeout so page execution is never blocked.
 *
 * This mirrors the waitForDigitalData() pattern used in order-confirmation.js
 * to guard the ORDER_CONFIRMATION push against a race where the block's
 * decorate() function fires before the ACDL script has fully initialised.
 *
 * @returns {Promise<Array>} resolves with window.adobeDataLayer
 */
function waitForAdobeDataLayer() {
  return new Promise((resolve) => {
    // Ensure the array exists so we can push into it
    window.adobeDataLayer = window.adobeDataLayer || [];

    // Fast path: ACDL already initialised (its script replaces Array.prototype.push)
    if (window.adobeDataLayer.push !== Array.prototype.push) {
      resolve(window.adobeDataLayer);
      return;
    }

    // Safety timeout – resolves if ACDL never loads (e.g. blocked, absent)
    const timeout = setTimeout(() => {
      console.warn('[digitalData] adobeDataLayer init timeout – proceeding with available layer');
      resolve(window.adobeDataLayer);
    }, 3000);

    // Push a function: ACDL calls any function it finds in the queue once it
    // has fully initialised, passing the live data-layer instance as argument.
    window.adobeDataLayer.push(function onAcdlReady() {
      clearTimeout(timeout);
      resolve(window.adobeDataLayer);
    });
  });
}

/**
 * Initialise window.adobeDataLayer (if not already present by ACDL script)
 * and push an event object into it.
 *
 * Adobe Client Data Layer expects objects with an `event` string property.
 * We map our internal eventType to the `event` key and spread the full
 * payload directly onto the object so Launch / Tags rules can access all
 * properties at the top level without drilling into an `eventInfo` wrapper.
 *
 * @param {object} eventObj  – the same enriched event object we push to digitalData
 */
function pushToAdobeDataLayer(eventObj) {
  window.adobeDataLayer = window.adobeDataLayer || [];
  const adobeEvent = {
    event: eventObj.eventType,
    ...eventObj,
  };
  window.adobeDataLayer.push(adobeEvent);
  console.log('[adobeDataLayer] event pushed:', JSON.stringify(adobeEvent, null, 2));
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
 * @param {string}  [userData.gender]       – e.g. 'male' | 'female'
 * @param {Array}   [userData.interests]    – e.g. ['sports', 'yoga', 'travel']
 * @param {string}  [userData.dob]          – ISO date string 'YYYY-MM-DD'
 * @param {string}  [userData.country]
 * @param {boolean} [userData.isEmailVerified]
 * @param {string}  [userData.source]          – e.g. 'BETA_COMMERCE'
 * @param {string}  [userData.eventId]         – UUID for the auth event
 * @param {string}  [userData.eventType]       – e.g. 'BETA_COMMERCE_USER_SIGNUP' | 'BETA_COMMERCE_USER_LOGIN'
 */
function setUser(userData) {
  // Merge with any extended profile saved in sessionStorage so that fields
  // not available on the Firebase user object (gender, interests, dob, phone)
  // are preserved when authStateChanged re-fires after a page load.
  const sessionProfile = getUserProfileFromSession() || {};

  window.digitalData.user = {
    authenticated: 'authenticated',
    customerId: userData.customerId || '',
    email: userData.email || '',
    firstName: userData.firstName || sessionProfile.firstName || '',
    lastName: userData.lastName || sessionProfile.lastName || '',
    phone: userData.phone || sessionProfile.phone || '',
    gender: userData.gender || sessionProfile.gender || '',
    interests: Array.isArray(userData.interests) && userData.interests.length > 0
      ? userData.interests
      : (Array.isArray(sessionProfile.interests) ? sessionProfile.interests : []),
    dob: userData.dob || sessionProfile.dob || '',
    country: userData.country || sessionProfile.country || '',
    isEmailVerified: userData.isEmailVerified !== undefined ? userData.isEmailVerified : false,
    source: userData.source || 'BETA_COMMERCE',
  };

  // Persist the extended profile fields so they survive page navigation
  // and Firebase re-auth (which only carries uid/email/displayName).
  saveUserProfileToSession(window.digitalData.user);

  const authEvent = {
    eventId: userData.eventId || crypto.randomUUID(),
    eventType: userData.eventType || 'BETA_COMMERCE_USER_LOGIN',
    source: userData.source || 'BETA_COMMERCE',
    user: { ...window.digitalData.user },
  };

  pushEvent(authEvent);
  pushToAdobeDataLayer(authEvent);

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
    gender: '',
    interests: [],
    dob: '',
    country: '',
    isEmailVerified: false,
    source: '',
  };

  // Clear the extended profile from sessionStorage on sign-out
  clearUserProfileFromSession();

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
 * Push an add-to-cart event and append the item to digitalData.cart.citems.
 * A unique betacartId is generated the first time an item is added and persisted
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
  // ── Generate / restore betacartId ──────────────────────────────────────────────
  if (!_cartId) {
    const storedCartId = sessionStorage.getItem('digitalData_cartId');
    if (storedCartId) {
      _cartId = storedCartId;
    } else {
      const newCartId = `CART-${crypto.randomUUID()}`;
      _cartId = newCartId;
      sessionStorage.setItem('digitalData_cartId', newCartId);
      console.log('[digitalData] 🆕 New betacartId generated:', newCartId);
    }
  }

  // Keep betacartId visible on the cart object
  window.digitalData.cart.betacartId = _cartId;

  // Check if an item with the same SKU already exists – if so, increment quantity
  const existingItem = window.digitalData.cart.citems.find((i) => i.sku && i.sku === (item.sku || ''));

  let cartItem;
  if (existingItem) {
    existingItem.quantity += (item.quantity || 1);
    cartItem = existingItem;
  } else {
    cartItem = {
      name: item.name || 'Unknown Product',
      sku: item.sku || '',
      price: item.price || '0.00',
      image: item.image || '',
      category: item.category || '',
      quantity: item.quantity || 1,
    };
    window.digitalData.cart.citems.push(cartItem);
  }

  saveCartToSession();

  const eventObj = {
    eventId: crypto.randomUUID(),
    eventType: 'ADD_TO_CART',
    source: 'BETA_COMMERCE',
    product: { ...cartItem },
    cart: {
      betacartId: _cartId,
      totalItems: window.digitalData.cart.citems.length,
      citems: [...window.digitalData.cart.citems],
    },
    user: { ...window.digitalData.user },
  };

  pushEvent(eventObj);
  pushToAdobeDataLayer(eventObj);

  // Publish to Kafka (non-blocking)
  publishCartEventToKafka(cartItem, _cartId, [...window.digitalData.cart.citems]);

  console.group('[digitalData] 🛒 Add-to-Cart');
  console.table(cartItem);
  console.log('Cart ID:', _cartId);
  console.log('Cart total items:', window.digitalData.cart.citems.length);
  console.groupEnd();
}

// ── Cart clear helper ─────────────────────────────────────────────────────────

/**
 * Empty digitalData.cart.citems and push a CART_CLEAR event.
 * Called directly or via the 'clearCart' CustomEvent.
 */
function clearCart() {
  const clearedItems = [...window.digitalData.cart.citems];
  const clearedCartId = _cartId;

  window.digitalData.cart.citems = [];
  window.digitalData.cart.betacartId = '';
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
      citems: [],
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
 * @param {string}  [orderData.betacartId]          – cart ID that was converted
 * @param {string}  [orderData.date]            – ISO timestamp of the order
 * @param {Array}   [orderData.citems]           – ordered items array
 * @param {string}  [orderData.total]           – order total string
 * @param {string}  [orderData.currency]        – currency code (default: INR)
 * @param {object}  [orderData.billingAddress]  – billing address object
 * @param {object}  [orderData.shippingAddress] – shipping address object
 * @param {object}  [orderData.paymentData]     – payment method summary
 */
function pushOrderConfirmation(orderData) {
  // betacartId: prefer value passed in orderData, otherwise use the module-level
  // _cartId that was generated when citems were added to cart.
  const resolvedCartId = orderData.betacartId || _cartId || sessionStorage.getItem('digitalData_cartId') || '';

  const orderConfirmation = {
    orderId: orderData.orderId || '',
    betacartId: resolvedCartId,
    date: orderData.date || new Date().toISOString(),
    total: parseFloat(orderData.total) || 0,
    currency: orderData.currency || 'INR',
    itemCount: (orderData.citems || []).length,
      citems: (orderData.citems || []).map((i) => ({
        ...i,
        price: parseFloat(i.price) || 0,
      })),
    billingAddress: orderData.billingAddress || {},
    shippingAddress: orderData.shippingAddress || {},
    payment: {
      method: orderData.paymentData ? orderData.paymentData.method : 'credit-card',
      last4: orderData.paymentData ? orderData.paymentData.last4 : '',
      cardType: orderData.paymentData ? (orderData.paymentData.cardType || '') : '',
      status: 'SUCCESS',
    },
    paymentStatus: 'SUCCESS',
    // Carry forward the customer snapshot saved at checkout time so that
    // publishOrderEventToKafka can use it if digitalData.user is still
    // unauthenticated after the page navigation.
    customer: orderData.customer || {},
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
  pushToAdobeDataLayer(eventObj);

  // Publish to Kafka (non-blocking)
  publishOrderEventToKafka(orderConfirmation);

  console.group('[digitalData] ✅ Order Confirmation');
  console.log('Order ID      :', orderConfirmation.orderId);
  console.log('Cart ID       :', orderConfirmation.betacartId);
  console.log('Total         :', orderConfirmation.currency, orderConfirmation.total);
  console.log('Payment Method:', orderConfirmation.payment.method);
  console.log('Last 4        :', orderConfirmation.payment.last4);
  console.log('Payment Status:', orderConfirmation.paymentStatus);
  console.table(orderData.citems || []);
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
    // Firebase user object only carries uid/email/displayName/phoneNumber.
    // setUser() will merge the extended profile (gender, interests, dob, phone)
    // from sessionStorage automatically, so nothing is lost after page navigation.
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
 * Restore betacartId, cart.citems, and orderConfirmation from sessionStorage so
 * that all state persists across page navigations.
 * betacartId is mirrored on digitalData.cart.betacartId and also appears in
 * digitalData.orderConfirmation once the order is placed.
 */
(function hydrateFromSession() {
  // Restore betacartId
  const storedCartId = sessionStorage.getItem('digitalData_cartId');
  if (storedCartId) {
    _cartId = storedCartId;
    window.digitalData.cart.betacartId = storedCartId;
    console.log('[digitalData] 🛒 betacartId restored from sessionStorage:', storedCartId);
  }

  // Restore cart items
  try {
    const storedItems = sessionStorage.getItem('digitalData_cartItems');
    if (storedItems) {
      const parsed = JSON.parse(storedItems);
      if (Array.isArray(parsed) && parsed.length > 0) {
        window.digitalData.cart.citems = parsed;
        console.log('[digitalData] 🛒 Cart citems restored from sessionStorage:', parsed.length, 'item(s)');
      }
    }
  } catch (e) {
    console.warn('[digitalData] Failed to restore cart citems from sessionStorage:', e);
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

    // Merge cookie identity with extended profile saved in sessionStorage
    // (gender, interests, dob, phone captured at signup time).
    const sessionProfile = getUserProfileFromSession() || {};

    window.digitalData.user = {
      authenticated: 'authenticated',
      customerId: cookieData.uid || '',
      email: cookieData.email || '',
      firstName: sessionProfile.firstName || '',
      lastName: sessionProfile.lastName || '',
      phone: sessionProfile.phone || '',
      gender: sessionProfile.gender || '',
      interests: Array.isArray(sessionProfile.interests) ? sessionProfile.interests : [],
      dob: sessionProfile.dob || '',
      country: sessionProfile.country || '',
      isEmailVerified: cookieData.emailVerified || false,
      source: 'BETA_COMMERCE',
    };

    console.group('[digitalData] 🍪 User hydrated from auth cookie + session profile');
    console.table(window.digitalData.user);
    console.groupEnd();
  } catch (err) {
    console.warn('[digitalData] Cookie hydration failed:', err);
  }
}());

console.log('[digitalData] ✅ Datalayer initialised', window.digitalData);

// Dispatch a ready event so blocks that run before this module finishes
// loading can listen and publish their Kafka events after user data is
// fully hydrated from cookie / sessionStorage.
window.dispatchEvent(new CustomEvent('digitalDataReady', { detail: window.digitalData }));

// ── Page View ─────────────────────────────────────────────────────────────────

/**
 * Build the page context object from the current location and document.
 *
 * @returns {object}
 */
function buildPageContext() {
  const { pathname, href, search, hash } = window.location;

  // Derive a human-readable page name from the last path segment,
  // falling back to the document title, then the pathname itself.
  const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean);
  const pageName = segments.length > 0
    ? segments[segments.length - 1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : document.title || pathname;

  return {
    path: pathname,
    url: href,
    title: document.title || '',
    name: pageName,
    queryString: search || '',
    hash: hash || '',
    referrer: document.referrer || '',
    language: document.documentElement.lang || navigator.language || '',
    hostname: window.location.hostname,
  };
}

/**
 * Push a PAGE_VIEW event to both digitalData.events and window.adobeDataLayer.
 * Fired once on the window 'load' event so the full page (including
 * any dynamically-set <title>) is available.
 *
 * Shape pushed to adobeDataLayer:
 * {
 *   event: 'PAGE_VIEW',
 *   eventId, eventType, source, timestamp,
 *   page: { path, url, title, name, queryString, hash, referrer, language, hostname },
 *   user: { authenticated, customerId, email, firstName, lastName, … }
 * }
 */
function pushPageView() {
  const page = buildPageContext();
  const user = { ...window.digitalData.user };

  const eventObj = {
    eventId: crypto.randomUUID(),
    eventType: 'PAGE_VIEW',
    source: 'BETA_COMMERCE',
    page,
    user,
  };

  pushEvent(eventObj);
  pushToAdobeDataLayer(eventObj);

  console.group('[digitalData] 📄 Page View');
  console.log('Path      :', page.path);
  console.log('Title     :', page.title);
  console.log('Referrer  :', page.referrer || '(none)');
  console.log('User      :', user.authenticated === 'authenticated' ? `${user.email} (${user.customerId})` : 'unauthenticated');
  console.groupEnd();
}

// Fire pageView after the page is fully loaded so the document title and
// any deferred user-hydration (cookie / authStateChanged) have completed.
// Because datalayer.js is loaded via a dynamic import(), the window 'load'
// event may have already fired by the time this code runs. Guard against
// that by checking document.readyState and calling pushPageView immediately
// when the page is already fully loaded.
if (document.readyState === 'complete') {
  pushPageView();
} else {
  window.addEventListener('load', pushPageView, { once: true });
}
