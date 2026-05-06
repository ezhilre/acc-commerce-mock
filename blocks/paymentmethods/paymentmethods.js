function validateExpiry(value) {
  if (!value || value.length < 5) return false;
  const parts = value.split('/');
  if (parts.length !== 2) return false;
  const month = parseInt(parts[0], 10);
  const year = parseInt(`20${parts[1]}`, 10);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  if (year < now.getFullYear()) return false;
  if (year === now.getFullYear() && month < now.getMonth() + 1) return false;
  return true;
}

function generateOrderId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

function showToast(message, isError) {
  let toast = document.getElementById('checkout-toast-msg');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'checkout-toast-msg';
    toast.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%) translateY(100px);
      color:#fff; padding:12px 24px; border-radius:8px; font-size:0.9rem; font-weight:600;
      box-shadow:0 4px 16px rgba(0,0,0,0.2); z-index:9999; transition:transform 0.3s ease;
      white-space:nowrap; font-family:inherit;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.background = isError ? '#d32f2f' : '#2e7d32';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(100px)';
  }, 3500);
}

export default function decorate(block) {
  const wrapper = document.createElement('div');
  wrapper.className = 'payment-methods-wrapper';

  const formHTML = `
    <div class="payment-methods-header">
      <h2 class="payment-methods-title">Payment Method</h2>
    </div>
    <div class="payment-methods-tabs">
      <button type="button" class="payment-tab active" data-method="credit-card">
        <span class="payment-tab-icon">&#128179;</span>
        <span>Credit Card</span>
      </button>
    </div>
    <div class="payment-methods-content">
      <div class="payment-panel credit-card-panel active" id="credit-card-panel">
        <div class="form-row narrow-field">
          <label for="card-name" class="form-label">Name on Card <span class="required">*</span></label>
          <input type="text" id="card-name" name="card-name" class="form-input" placeholder="John Doe" autocomplete="cc-name">
          <span class="field-error" id="card-name-error"></span>
        </div>
        <div class="form-row narrow-field">
          <label for="card-number" class="form-label">Card Number <span class="required">*</span></label>
          <div class="card-number-wrapper">
            <input type="text" id="card-number" name="card-number" class="form-input" placeholder="1234 5678 9012 3456" autocomplete="cc-number" maxlength="19" inputmode="numeric">
            <span class="card-type-badge" id="card-type-badge"></span>
          </div>
          <span class="field-error" id="card-number-error"></span>
        </div>
        <div class="form-row two-col">
          <div class="form-group">
            <label for="card-expiry" class="form-label">Expiry Date <span class="required">*</span></label>
            <input type="text" id="card-expiry" name="card-expiry" class="form-input" placeholder="MM/YY" autocomplete="cc-exp" maxlength="5" inputmode="numeric">
            <span class="field-error" id="card-expiry-error"></span>
          </div>
          <div class="form-group">
            <label for="card-cvv" class="form-label">CVV <span class="required">*</span></label>
            <div class="cvv-wrapper">
              <input type="password" id="card-cvv" name="card-cvv" class="form-input" placeholder="&bull;&bull;&bull;" autocomplete="cc-csc" maxlength="4" inputmode="numeric">
              <span class="cvv-help" title="3-4 digit security code on back of card">?</span>
            </div>
            <span class="field-error" id="card-cvv-error"></span>
          </div>
        </div>
        <div class="secure-badge">
          <span class="lock-icon">&#128274;</span>
          <span>Your payment information is encrypted and secure.</span>
        </div>
      </div>
    </div>
    <div class="place-order-section">
      <button type="button" class="place-order-btn" id="place-order-btn">
        Place Order
      </button>
      <p class="order-terms">By placing your order, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.</p>
    </div>
  `;

  wrapper.innerHTML = formHTML;
  block.innerHTML = '';
  block.appendChild(wrapper);

  // ── Card number formatting ──
  const cardNumberInput = block.querySelector('#card-number');
  cardNumberInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 16);
    val = val.replace(/(.{4})/g, '$1 ').trim();
    e.target.value = val;
    const badge = block.querySelector('#card-type-badge');
    const raw = val.replace(/\s/g, '');
    if (/^4/.test(raw)) { badge.textContent = 'VISA'; badge.className = 'card-type-badge visa'; }
    else if (/^5[1-5]/.test(raw)) { badge.textContent = 'MC'; badge.className = 'card-type-badge mc'; }
    else if (/^3[47]/.test(raw)) { badge.textContent = 'AMEX'; badge.className = 'card-type-badge amex'; }
    else { badge.textContent = ''; badge.className = 'card-type-badge'; }
    block.querySelector('#card-number-error').textContent = '';
    cardNumberInput.classList.remove('input-error');
  });

  // ── Expiry formatting ──
  const expiryInput = block.querySelector('#card-expiry');
  expiryInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 3) val = `${val.substring(0, 2)}/${val.substring(2)}`;
    e.target.value = val;
    block.querySelector('#card-expiry-error').textContent = '';
    expiryInput.classList.remove('input-error');
  });

  // ── CVV digits only ──
  const cvvInput = block.querySelector('#card-cvv');
  cvvInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
    block.querySelector('#card-cvv-error').textContent = '';
    cvvInput.classList.remove('input-error');
  });

  // ── Name real-time clear ──
  const nameInput = block.querySelector('#card-name');
  nameInput.addEventListener('input', () => {
    block.querySelector('#card-name-error').textContent = '';
    nameInput.classList.remove('input-error');
  });

  // ── Validate payment fields ──
  function validatePayment() {
    let valid = true;

    if (!nameInput.value.trim()) {
      block.querySelector('#card-name-error').textContent = 'Name on card is required.';
      nameInput.classList.add('input-error');
      valid = false;
    }

    const rawCard = cardNumberInput.value.replace(/\s/g, '');
    if (rawCard.length < 13) {
      block.querySelector('#card-number-error').textContent = 'Please enter a valid card number.';
      cardNumberInput.classList.add('input-error');
      valid = false;
    }

    if (!validateExpiry(expiryInput.value)) {
      block.querySelector('#card-expiry-error').textContent = 'Please enter a valid future expiry date (MM/YY).';
      expiryInput.classList.add('input-error');
      valid = false;
    }

    if (cvvInput.value.length < 3) {
      block.querySelector('#card-cvv-error').textContent = 'CVV must be 3 or 4 digits.';
      cvvInput.classList.add('input-error');
      valid = false;
    }

    return valid;
  }

  // ── Place Order ──
  const placeOrderBtn = block.querySelector('#place-order-btn');
  placeOrderBtn.addEventListener('click', () => {
    // Find billing block
    const billingBlock = document.querySelector('.billingaddress');
    const shippingBlock = document.querySelector('.shippingaddress');

    let billingValid = true;
    let shippingValid = true;

    // Validate billing
    if (billingBlock && typeof billingBlock.validateForm === 'function') {
      billingValid = billingBlock.validateForm();
    } else {
      // Fallback: manual billing validation
      const fields = ['billing-street', 'billing-city', 'billing-state', 'billing-zip', 'billing-country'];
      fields.forEach((id) => {
        const el = document.getElementById(id);
        const err = document.getElementById(`${id}-error`);
        if (el && !el.value.trim()) {
          if (err) err.textContent = 'This field is required.';
          if (el) el.classList.add('input-error');
          billingValid = false;
        }
      });
    }

    // Validate shipping
    if (shippingBlock && typeof shippingBlock.validateForm === 'function') {
      shippingValid = shippingBlock.validateForm();
    }

    const paymentValid = validatePayment();

    if (!billingValid) {
      if (billingBlock) billingBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Please fill in all billing address fields.', true);
      return;
    }
    if (!shippingValid) {
      if (shippingBlock) shippingBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Please fill in all shipping address fields.', true);
      return;
    }
    if (!paymentValid) {
      block.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Please fix payment details.', true);
      return;
    }

    // ── Collect order data ──
    let billingAddress = {
      street: '',
      city: '',
      state: '',
      zip: '',
      country: 'US',
    };

    if (billingBlock && typeof billingBlock.getAddress === 'function') {
      billingAddress = billingBlock.getAddress();
    } else {
      billingAddress = {
        street: (document.getElementById('billing-street') || {}).value || '',
        city: (document.getElementById('billing-city') || {}).value || '',
        state: (document.getElementById('billing-state') || {}).value || '',
        zip: (document.getElementById('billing-zip') || {}).value || '',
        country: (document.getElementById('billing-country') || {}).value || 'US',
      };
    }

    let shippingAddress = billingAddress;
    if (shippingBlock && typeof shippingBlock.getAddress === 'function') {
      const addr = shippingBlock.getAddress();
      if (addr) shippingAddress = addr;
    }

    const cardNumber = cardNumberInput.value;
    const last4 = cardNumber.replace(/\s/g, '').slice(-4);
    const paymentData = {
      method: 'credit-card',
      nameOnCard: nameInput.value,
      last4,
      expiry: expiryInput.value,
    };

    const cart = (() => {
      try {
        return JSON.parse(localStorage.getItem('acc_commerce_cart') || localStorage.getItem('cart') || '[]');
      } catch (e) {
        return [];
      }
    })();

    const total = cart.reduce((s, i) => s + (parseFloat((i.price || '0').toString().replace(/[^0-9.]/g, '')) || 0) * (parseInt(i.quantity, 10) || 1), 0);

    const orderData = {
      orderId: generateOrderId(),
      date: new Date().toISOString(),
      billingAddress,
      shippingAddress,
      paymentData,
      items: cart,
      total: total.toFixed(2),
    };

    try {
      localStorage.setItem('lastOrder', JSON.stringify(orderData));
      localStorage.removeItem('acc_commerce_cart');
      localStorage.removeItem('cart');
    } catch (e) { /* ignore */ }

    // ── Navigate ──
    placeOrderBtn.textContent = 'Placing Order...';
    placeOrderBtn.disabled = true;
    showToast('Order placed! Redirecting...', false);

    setTimeout(() => {
      window.location.href = '/order-confirmation';
    }, 800);
  });

  // Expose API for external use
  block.validateForm = validatePayment;
  block.getPaymentData = () => {
    const last4 = cardNumberInput.value.replace(/\s/g, '').slice(-4);
    return {
      method: 'credit-card',
      nameOnCard: nameInput.value,
      last4,
      expiry: expiryInput.value,
    };
  };
}
