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
        <form class="credit-card-form" id="credit-card-form" novalidate>
          <div class="card-logos">
            <span class="card-logo visa" title="Visa">VISA</span>
            <span class="card-logo mastercard" title="Mastercard">MC</span>
            <span class="card-logo amex" title="American Express">AMEX</span>
          </div>
          <div class="form-row">
            <label for="card-name" class="form-label">Name on Card <span class="required">*</span></label>
            <input type="text" id="card-name" name="card-name" class="form-input" placeholder="John Doe" required autocomplete="cc-name">
            <span class="field-error" id="card-name-error"></span>
          </div>
          <div class="form-row">
            <label for="card-number" class="form-label">Card Number <span class="required">*</span></label>
            <div class="card-number-wrapper">
              <input type="text" id="card-number" name="card-number" class="form-input" placeholder="1234 5678 9012 3456" required autocomplete="cc-number" maxlength="19" inputmode="numeric">
              <span class="card-type-badge" id="card-type-badge"></span>
            </div>
            <span class="field-error" id="card-number-error"></span>
          </div>
          <div class="form-row two-col">
            <div class="form-group">
              <label for="card-expiry" class="form-label">Expiry Date <span class="required">*</span></label>
              <input type="text" id="card-expiry" name="card-expiry" class="form-input" placeholder="MM/YY" required autocomplete="cc-exp" maxlength="5" inputmode="numeric">
              <span class="field-error" id="card-expiry-error"></span>
            </div>
            <div class="form-group">
              <label for="card-cvv" class="form-label">CVV <span class="required">*</span></label>
              <div class="cvv-wrapper">
                <input type="password" id="card-cvv" name="card-cvv" class="form-input" placeholder="&bull;&bull;&bull;" required autocomplete="cc-csc" maxlength="4" inputmode="numeric">
                <span class="cvv-help" title="3-4 digit security code on back of card">?</span>
              </div>
              <span class="field-error" id="card-cvv-error"></span>
            </div>
          </div>
          <div class="secure-badge">
            <span class="lock-icon">&#128274;</span>
            <span>Your payment information is encrypted and secure.</span>
          </div>
        </form>
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

  // Card number formatting (groups of 4)
  const cardNumberInput = block.querySelector('#card-number');
  cardNumberInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 16);
    val = val.replace(/(.{4})/g, '$1 ').trim();
    e.target.value = val;

    // Detect card type
    const badge = block.querySelector('#card-type-badge');
    const raw = val.replace(/\s/g, '');
    if (/^4/.test(raw)) {
      badge.textContent = 'VISA';
      badge.className = 'card-type-badge visa';
    } else if (/^5[1-5]/.test(raw)) {
      badge.textContent = 'MC';
      badge.className = 'card-type-badge mc';
    } else if (/^3[47]/.test(raw)) {
      badge.textContent = 'AMEX';
      badge.className = 'card-type-badge amex';
    } else {
      badge.textContent = '';
      badge.className = 'card-type-badge';
    }

    const errorEl = block.querySelector('#card-number-error');
    if (raw.length > 0 && errorEl) {
      errorEl.textContent = '';
      cardNumberInput.classList.remove('input-error');
    }
  });

  // Expiry formatting MM/YY
  const expiryInput = block.querySelector('#card-expiry');
  expiryInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 3) {
      val = val.substring(0, 2) + '/' + val.substring(2);
    }
    e.target.value = val;

    const errorEl = block.querySelector('#card-expiry-error');
    if (val.length > 0 && errorEl) {
      errorEl.textContent = '';
      expiryInput.classList.remove('input-error');
    }
  });

  // CVV - only digits
  const cvvInput = block.querySelector('#card-cvv');
  cvvInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
    const errorEl = block.querySelector('#card-cvv-error');
    if (e.target.value.length > 0 && errorEl) {
      errorEl.textContent = '';
      cvvInput.classList.remove('input-error');
    }
  });

  // Real-time clearing of errors for name
  const nameInput = block.querySelector('#card-name');
  nameInput.addEventListener('input', () => {
    const errorEl = block.querySelector('#card-name-error');
    if (nameInput.value.trim() && errorEl) {
      errorEl.textContent = '';
      nameInput.classList.remove('input-error');
    }
  });

  // Expose validation method
  block.validateForm = function validateForm() {
    let valid = true;

    // Validate card name
    const nameEl = block.querySelector('#card-name');
    const nameError = block.querySelector('#card-name-error');
    if (!nameEl.value.trim()) {
      nameError.textContent = 'Name on card is required.';
      nameEl.classList.add('input-error');
      valid = false;
    }

    // Validate card number (any number, at least 13 digits)
    const cardEl = block.querySelector('#card-number');
    const cardError = block.querySelector('#card-number-error');
    const rawCard = cardEl.value.replace(/\s/g, '');
    if (rawCard.length < 13) {
      cardError.textContent = 'Please enter a valid card number.';
      cardEl.classList.add('input-error');
      valid = false;
    }

    // Validate expiry (must be future date)
    const expiryEl = block.querySelector('#card-expiry');
    const expiryError = block.querySelector('#card-expiry-error');
    const expiryVal = expiryEl.value;
    if (!validateExpiry(expiryVal)) {
      expiryError.textContent = 'Please enter a valid future expiry date (MM/YY).';
      expiryEl.classList.add('input-error');
      valid = false;
    }

    // Validate CVV (any 3-4 digits)
    const cvvEl = block.querySelector('#card-cvv');
    const cvvError = block.querySelector('#card-cvv-error');
    if (cvvEl.value.length < 3) {
      cvvError.textContent = 'CVV must be 3 or 4 digits.';
      cvvEl.classList.add('input-error');
      valid = false;
    }

    return valid;
  };

  // Expose getter for payment data
  block.getPaymentData = function getPaymentData() {
    const cardNumber = block.querySelector('#card-number').value;
    const last4 = cardNumber.replace(/\s/g, '').slice(-4);
    return {
      method: 'credit-card',
      nameOnCard: block.querySelector('#card-name').value,
      last4,
      expiry: block.querySelector('#card-expiry').value,
    };
  };

  // Place order button
  const placeOrderBtn = block.querySelector('#place-order-btn');
  placeOrderBtn.addEventListener('click', () => {
    // Dispatch custom event – the checkout page script handles full validation
    const event = new CustomEvent('placeOrder', { bubbles: true });
    block.dispatchEvent(event);
  });
}

function validateExpiry(value) {
  if (!value || value.length < 5) return false;
  const parts = value.split('/');
  if (parts.length !== 2) return false;

  const month = parseInt(parts[0], 10);
  const year = parseInt('20' + parts[1], 10);

  if (month < 1 || month > 12) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;

  return true;
}
