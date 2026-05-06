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

  // ── Push ORDER_CONFIRMATION event to datalayer ────────────────────────────
  if (window.digitalData && window.digitalData.pushOrderConfirmation) {
    window.digitalData.pushOrderConfirmation(order);
  } else if (window.digitalData && window.digitalData.push) {
    // Fallback: use generic push if pushOrderConfirmation isn't available yet
    window.digitalData.push({
      eventId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `evt-${Date.now()}`,
      eventType: 'ORDER_CONFIRMATION',
      source: 'BETA_COMMERCE',
      paymentStatus: 'SUCCESS',
      order: {
        orderId: order.orderId || '',
        cartId: order.cartId || '',
        date: order.date || new Date().toISOString(),
        total: order.total || '0.00',
        currency: order.currency || 'INR',
        itemCount: (order.items || []).length,
        items: order.items || [],
        billingAddress: order.billingAddress || {},
        shippingAddress: order.shippingAddress || {},
        payment: {
          method: order.paymentData ? order.paymentData.method : 'credit-card',
          last4: order.paymentData ? order.paymentData.last4 : '',
          status: 'SUCCESS',
        },
      },
      user: window.digitalData.user ? { ...window.digitalData.user } : {},
    });
  }

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
