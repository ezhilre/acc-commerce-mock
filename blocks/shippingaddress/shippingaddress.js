export default function decorate(block) {
  const wrapper = document.createElement('div');
  wrapper.className = 'shipping-address-wrapper';

  const formHTML = `
    <div class="shipping-address-header">
      <h2 class="shipping-address-title">Shipping Address</h2>
      <label class="same-as-billing-label">
        <input type="checkbox" id="same-as-billing" name="same-as-billing" checked>
        <span class="checkbox-text">Same as billing address</span>
      </label>
    </div>
    <div class="shipping-address-fields" style="display:none;">
      <form class="shipping-address-form" id="shipping-address-form" novalidate>
        <div class="form-row">
          <label for="shipping-street" class="form-label">Street <span class="required">*</span></label>
          <input type="text" id="shipping-street" name="street" class="form-input" placeholder="123 Main Street" autocomplete="shipping street-address">
          <span class="field-error" id="shipping-street-error"></span>
        </div>
        <div class="form-row two-col">
          <div class="form-group">
            <label for="shipping-city" class="form-label">City <span class="required">*</span></label>
            <input type="text" id="shipping-city" name="city" class="form-input" placeholder="Mumbai" autocomplete="shipping address-level2">
            <span class="field-error" id="shipping-city-error"></span>
          </div>
          <div class="form-group">
            <label for="shipping-state" class="form-label">State <span class="required">*</span></label>
            <input type="text" id="shipping-state" name="state" class="form-input" placeholder="Maharashtra" autocomplete="shipping address-level1">
            <span class="field-error" id="shipping-state-error"></span>
          </div>
        </div>
        <div class="form-row two-col">
          <div class="form-group">
            <label for="shipping-zip" class="form-label">Zip Code <span class="required">*</span></label>
            <input type="text" id="shipping-zip" name="zip" class="form-input" placeholder="400001" autocomplete="shipping postal-code" maxlength="10" inputmode="numeric">
            <span class="field-error" id="shipping-zip-error"></span>
          </div>
          <div class="form-group">
            <label for="shipping-country" class="form-label">Country <span class="required">*</span></label>
            <input type="text" id="shipping-country" name="country" class="form-input" placeholder="India" autocomplete="shipping country-name">
            <span class="field-error" id="shipping-country-error"></span>
          </div>
        </div>
      </form>
    </div>
    <div class="shipping-same-as-billing-summary" id="shipping-summary">
      <p class="same-billing-note">
        <span class="checkmark-icon">&#10003;</span>
        Shipping address is the same as your billing address.
      </p>
    </div>
  `;

  wrapper.innerHTML = formHTML;
  block.innerHTML = '';
  block.appendChild(wrapper);

  const checkbox = block.querySelector('#same-as-billing');
  const fieldsSection = block.querySelector('.shipping-address-fields');
  const summary = block.querySelector('#shipping-summary');

  function toggleShippingFields() {
    if (checkbox.checked) {
      fieldsSection.style.display = 'none';
      summary.style.display = 'block';
      block.querySelectorAll('.shipping-address-form input').forEach((el) => {
        el.removeAttribute('required');
      });
    } else {
      fieldsSection.style.display = 'block';
      summary.style.display = 'none';
      const requiredIds = ['shipping-street', 'shipping-city', 'shipping-state', 'shipping-zip', 'shipping-country'];
      requiredIds.forEach((id) => {
        const el = block.querySelector(`#${id}`);
        if (el) el.setAttribute('required', '');
      });
    }
  }

  checkbox.addEventListener('change', toggleShippingFields);
  toggleShippingFields();

  block.validateForm = function validateForm() {
    if (checkbox.checked) return true;
    const form = block.querySelector('#shipping-address-form');
    const inputs = form.querySelectorAll('[required]');
    let valid = true;
    inputs.forEach((input) => {
      const errorEl = form.querySelector(`#${input.id}-error`);
      if (!input.value.trim()) {
        if (errorEl) errorEl.textContent = 'This field is required.';
        input.classList.add('input-error');
        valid = false;
      } else {
        if (errorEl) errorEl.textContent = '';
        input.classList.remove('input-error');
      }
    });
    return valid;
  };

  block.getAddress = function getAddress() {
    if (checkbox.checked) return null;
    return {
      street: block.querySelector('#shipping-street').value,
      city: block.querySelector('#shipping-city').value,
      state: block.querySelector('#shipping-state').value,
      zip: block.querySelector('#shipping-zip').value,
      country: block.querySelector('#shipping-country').value,
    };
  };

  block.isSameAsBilling = function isSameAsBilling() {
    return checkbox.checked;
  };

  block.querySelectorAll('.form-input').forEach((input) => {
    input.addEventListener('input', () => {
      const errorEl = block.querySelector(`#${input.id}-error`);
      if (input.value.trim() && errorEl) {
        errorEl.textContent = '';
        input.classList.remove('input-error');
      }
    });
  });
}
