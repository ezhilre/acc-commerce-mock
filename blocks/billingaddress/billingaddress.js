export default function decorate(block) {
  const wrapper = document.createElement('div');
  wrapper.className = 'billing-address-wrapper';

  const formHTML = `
    <div class="billing-address-header">
      <h2 class="billing-address-title">Billing Address</h2>
    </div>
    <form class="billing-address-form" id="billing-address-form" novalidate>
      <div class="form-row">
        <label for="billing-street" class="form-label">Street <span class="required">*</span></label>
        <input type="text" id="billing-street" name="street" class="form-input" placeholder="123 Main Street" required autocomplete="street-address">
        <span class="field-error" id="billing-street-error"></span>
      </div>
      <div class="form-row two-col">
        <div class="form-group">
          <label for="billing-city" class="form-label">City <span class="required">*</span></label>
          <input type="text" id="billing-city" name="city" class="form-input" placeholder="Mumbai" required autocomplete="address-level2">
          <span class="field-error" id="billing-city-error"></span>
        </div>
        <div class="form-group">
          <label for="billing-state" class="form-label">State <span class="required">*</span></label>
          <input type="text" id="billing-state" name="state" class="form-input" placeholder="Maharashtra" required autocomplete="address-level1">
          <span class="field-error" id="billing-state-error"></span>
        </div>
      </div>
      <div class="form-row two-col">
        <div class="form-group">
          <label for="billing-zip" class="form-label">Zip Code <span class="required">*</span></label>
          <input type="text" id="billing-zip" name="zip" class="form-input" placeholder="400001" required autocomplete="postal-code" maxlength="10" inputmode="numeric">
          <span class="field-error" id="billing-zip-error"></span>
        </div>
        <div class="form-group">
          <label for="billing-country" class="form-label">Country <span class="required">*</span></label>
          <input type="text" id="billing-country" name="country" class="form-input" placeholder="India" required autocomplete="country-name">
          <span class="field-error" id="billing-country-error"></span>
        </div>
      </div>
    </form>
  `;

  wrapper.innerHTML = formHTML;
  block.innerHTML = '';
  block.appendChild(wrapper);

  // Expose validation method for checkout
  block.validateForm = function validateForm() {
    const form = block.querySelector('#billing-address-form');
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

  // Expose getter for address data
  block.getAddress = function getAddress() {
    return {
      street: block.querySelector('#billing-street').value,
      city: block.querySelector('#billing-city').value,
      state: block.querySelector('#billing-state').value,
      zip: block.querySelector('#billing-zip').value,
      country: block.querySelector('#billing-country').value,
    };
  };

  // Real-time clearing of errors
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
