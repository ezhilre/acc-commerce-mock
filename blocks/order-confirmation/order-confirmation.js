/**
 * Returns a Promise that resolves once window.digitalData is fully hydrated
 * (cookie + sessionStorage). If datalayer.js has already dispatched the
 * 'digitalDataReady' event we resolve immediately; otherwise we wait for it
 * with a 3-second safety timeout so the page never hangs.
 */
function waitForDigitalData() {
  return new Promise((resolve) => {
    // Already ready (module loaded synchronously before us)
    if (window.digitalData && window.digitalData.pushOrderConfirmation) {
      resolve(window.digitalData);
      return;
    }
    const timeout = setTimeout(() => {
      console.warn('[order-confirmation] digitalDataReady timeout – proceeding with available data');
      resolve(window.digitalData || {});
    }, 3000);
    window.addEventListener('digitalDataReady', (e) => {
      clearTimeout(timeout);
      resolve(e.detail || window.digitalData || {});
    }, { once: true });
  });
}

function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return isoString;
  }
}

function formatAddress(addr) {
  if (!addr) return 'N/A';
  const parts = [addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean);
  return parts.join(', ');
}

export default function decorate(block) {
  block.innerHTML = '';

  // Read order from localStorage
  let order = null;
  try {
    order = JSON.parse(localStorage.getItem('lastOrder') || 'null');
  } catch (e) {
    order = null;
  }

  if (!order) {
    // No order found — show a fallback
    block.innerHTML = `
      <div class="order-confirmation-wrapper no-order">
        <div class="order-confirmation-icon-circle">&#9888;</div>
        <h1 class="order-confirmation-title">No Order Found</h1>
        <p class="order-confirmation-subtitle">We couldn't find a recent order. Please go back and place your order.</p>
        <a href="/checkout" class="order-continue-btn">Go to Checkout</a>
      </div>
    `;
    return;
  }

  // ── Publish ORDER_CONFIRMATION event to Kafka via datalayer ──────────────
  // Wait for datalayer.js to finish hydrating user data from cookie/session
  // before calling pushOrderConfirmation so that customerId, email and
  // eventId are never empty in the Kafka payload.
  waitForDigitalData().then((dd) => {
    if (dd && dd.pushOrderConfirmation) {
      dd.pushOrderConfirmation(order);
    } else {
      console.warn('[order-confirmation] datalayer not available; ORDER_CONFIRMATION not pushed');
    }
  });

  // ── Clear cartId from sessionStorage — cart is now converted to order ─────
  sessionStorage.removeItem('digitalData_cartId');

  const {
    orderId,
    cartId = '',
    date,
    billingAddress,
    shippingAddress,
    paymentData,
    items = [],
    total = '0.00',
  } = order;

  const itemsHTML = items.length > 0
    ? items.map((item) => `
        <div class="order-item">
          ${item.image ? `<img class="order-item-img" src="${item.image}" alt="${item.name}" loading="lazy">` : '<div class="order-item-img-placeholder">&#128230;</div>'}
          <div class="order-item-details">
            <div class="order-item-name">${item.name || 'Product'}</div>
            <div class="order-item-sku">SKU: ${item.sku || '—'}</div>
            <div class="order-item-qty">Qty: ${item.quantity || 1}</div>
          </div>
          <div class="order-item-price">&#8377;${(parseFloat(item.price || 0) * (parseInt(item.quantity, 10) || 1)).toFixed(2)}</div>
        </div>
      `).join('')
    : '<p class="order-no-items">No items in this order.</p>';

  const cardNetworkIcon = (() => {
    if (!paymentData) return '&#128179;';
    if (paymentData.last4) {
      // Try to infer from order — just use a generic card icon
      return '&#128179;';
    }
    return '&#128179;';
  })();

  block.innerHTML = `
    <div class="order-confirmation-wrapper">

      <!-- Success hero -->
      <div class="order-confirmation-hero">
        <div class="order-confirmation-icon-circle">&#10003;</div>
        <h1 class="order-confirmation-title">Order Confirmed!</h1>
        <p class="order-confirmation-subtitle">Thank you for your purchase. Your order has been placed successfully.</p>
        <div class="order-id-badge">
          <span class="order-id-label">Order ID:</span>
          <span class="order-id-value">${orderId}</span>
        </div>
        ${cartId ? `<div class="order-id-badge" style="margin-top:6px;opacity:0.75;font-size:0.8em;">
          <span class="order-id-label">Cart ID:</span>
          <span class="order-id-value">${cartId}</span>
        </div>` : ''}
        <div class="order-date">${formatDate(date)}</div>
      </div>

      <!-- Details grid -->
      <div class="order-details-grid">

        <!-- Billing -->
        <div class="order-detail-card">
          <div class="order-detail-card-header">
            <span class="order-detail-icon">&#128205;</span>
            <span class="order-detail-heading">Billing Address</span>
          </div>
          <p class="order-detail-text">${formatAddress(billingAddress)}</p>
        </div>

        <!-- Shipping -->
        <div class="order-detail-card">
          <div class="order-detail-card-header">
            <span class="order-detail-icon">&#128666;</span>
            <span class="order-detail-heading">Shipping Address</span>
          </div>
          <p class="order-detail-text">${formatAddress(shippingAddress)}</p>
        </div>

        <!-- Payment -->
        <div class="order-detail-card">
          <div class="order-detail-card-header">
            <span class="order-detail-icon">&#128179;</span>
            <span class="order-detail-heading">Payment</span>
          </div>
          <div class="payment-summary-card">
            <span class="payment-card-icon">${cardNetworkIcon}</span>
            <div class="payment-card-info">
              <div class="payment-card-type">Credit Card</div>
              <div class="payment-card-last4">Ending in ${paymentData ? paymentData.last4 : '****'}</div>
            </div>
          </div>
        </div>

        <!-- Delivery -->
        <div class="order-detail-card">
          <div class="order-detail-card-header">
            <span class="order-detail-icon">&#128230;</span>
            <span class="order-detail-heading">Estimated Delivery</span>
          </div>
          <p class="order-detail-text delivery-days">3–5 Business Days</p>
          <p class="order-detail-sub">Standard shipping</p>
        </div>

      </div>

      <!-- Order items -->
      <div class="order-items-section">
        <div class="order-items-header">
          <span>&#128722;</span>
          <span>Order Items</span>
        </div>
        <div class="order-items-list">${itemsHTML}</div>
        <div class="order-total-row">
          <span>Total</span>
          <span class="order-total-amount">&#8377;${parseFloat(total).toFixed(2)}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="order-confirmation-actions">
        <a href="/" class="order-continue-btn primary">Continue Shopping</a>
      </div>

    </div>
  `;
}
