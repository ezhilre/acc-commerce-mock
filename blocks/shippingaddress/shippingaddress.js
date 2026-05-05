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
            <input type="text" id="shipping-city" name="city" class="form-input" placeholder="New York" autocomplete="shipping address-level2">
            <span class="field-error" id="shipping-city-error"></span>
          </div>
          <div class="form-group">
            <label for="shipping-state" class="form-label">State <span class="required">*</span></label>
            <select id="shipping-state" name="state" class="form-select" autocomplete="shipping address-level1">
              <option value="">Select State</option>
              <option value="AL">Alabama</option>
              <option value="AK">Alaska</option>
              <option value="AZ">Arizona</option>
              <option value="AR">Arkansas</option>
              <option value="CA">California</option>
              <option value="CO">Colorado</option>
              <option value="CT">Connecticut</option>
              <option value="DE">Delaware</option>
              <option value="FL">Florida</option>
              <option value="GA">Georgia</option>
              <option value="HI">Hawaii</option>
              <option value="ID">Idaho</option>
              <option value="IL">Illinois</option>
              <option value="IN">Indiana</option>
              <option value="IA">Iowa</option>
              <option value="KS">Kansas</option>
              <option value="KY">Kentucky</option>
              <option value="LA">Louisiana</option>
              <option value="ME">Maine</option>
              <option value="MD">Maryland</option>
              <option value="MA">Massachusetts</option>
              <option value="MI">Michigan</option>
              <option value="MN">Minnesota</option>
              <option value="MS">Mississippi</option>
              <option value="MO">Missouri</option>
              <option value="MT">Montana</option>
              <option value="NE">Nebraska</option>
              <option value="NV">Nevada</option>
              <option value="NH">New Hampshire</option>
              <option value="NJ">New Jersey</option>
              <option value="NM">New Mexico</option>
              <option value="NY">New York</option>
              <option value="NC">North Carolina</option>
              <option value="ND">North Dakota</option>
              <option value="OH">Ohio</option>
              <option value="OK">Oklahoma</option>
              <option value="OR">Oregon</option>
              <option value="PA">Pennsylvania</option>
              <option value="RI">Rhode Island</option>
              <option value="SC">South Carolina</option>
              <option value="SD">South Dakota</option>
              <option value="TN">Tennessee</option>
              <option value="TX">Texas</option>
              <option value="UT">Utah</option>
              <option value="VT">Vermont</option>
              <option value="VA">Virginia</option>
              <option value="WA">Washington</option>
              <option value="WV">West Virginia</option>
              <option value="WI">Wisconsin</option>
              <option value="WY">Wyoming</option>
            </select>
            <span class="field-error" id="shipping-state-error"></span>
          </div>
        </div>
        <div class="form-row two-col">
          <div class="form-group">
            <label for="shipping-zip" class="form-label">Zip Code <span class="required">*</span></label>
            <input type="text" id="shipping-zip" name="zip" class="form-input" placeholder="10001" autocomplete="shipping postal-code" maxlength="10">
            <span class="field-error" id="shipping-zip-error"></span>
          </div>
          <div class="form-group">
            <label for="shipping-country" class="form-label">Country <span class="required">*</span></label>
            <select id="shipping-country" name="country" class="form-select" autocomplete="shipping country">
              <option value="US" selected>United States</option>
              <option value="CA">Canada</option>
              <option value="GB">United Kingdom</option>
              <option value="AU">Australia</option>
              <option value="IN">India</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="JP">Japan</option>
              <option value="SG">Singapore</option>
              <option value="AE">UAE</option>
            </select>
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
      // Remove required attrs when hidden
      block.querySelectorAll('.shipping-address-form [required]').forEach((el) => {
        el.removeAttribute('required');
      });
    } else {
      fieldsSection.style.display = 'block';
      summary.style.display = 'none';
      // Restore required attrs when visible
      const requiredIds = ['shipping-street', 'shipping-city', 'shipping-state', 'shipping-zip', 'shipping-country'];
      requiredIds.forEach((id) => {
        const el = block.querySelector(`#${id}`);
        if (el) el.setAttribute('required', '');
      });
    }
  }

  checkbox.addEventListener('change', toggleShippingFields);
  // Initial state: checked = same as billing
  toggleShippingFields();

  // Expose validation method
  block.validateForm = function validateForm() {
    if (checkbox.checked) return true; // No validation needed when same as billing

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

  // Expose getter for address data
  block.getAddress = function getAddress() {
    if (checkbox.checked) return null; // caller should use billing address
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

  // Real-time clearing of errors
  block.querySelectorAll('.form-input, .form-select').forEach((input) => {
    input.addEventListener('input', () => {
      const errorEl = block.querySelector(`#${input.id}-error`);
      if (input.value.trim() && errorEl) {
        errorEl.textContent = '';
        input.classList.remove('input-error');
      }
    });
  });
}
