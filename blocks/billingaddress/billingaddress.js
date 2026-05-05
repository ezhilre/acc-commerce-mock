export default function decorate(block) {
  // Build billing address form
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
          <input type="text" id="billing-city" name="city" class="form-input" placeholder="New York" required autocomplete="address-level2">
          <span class="field-error" id="billing-city-error"></span>
        </div>
        <div class="form-group">
          <label for="billing-state" class="form-label">State <span class="required">*</span></label>
          <select id="billing-state" name="state" class="form-select" required autocomplete="address-level1">
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
          <span class="field-error" id="billing-state-error"></span>
        </div>
      </div>
      <div class="form-row two-col">
        <div class="form-group">
          <label for="billing-zip" class="form-label">Zip Code <span class="required">*</span></label>
          <input type="text" id="billing-zip" name="zip" class="form-input" placeholder="10001" required autocomplete="postal-code" maxlength="10">
          <span class="field-error" id="billing-zip-error"></span>
        </div>
        <div class="form-group">
          <label for="billing-country" class="form-label">Country <span class="required">*</span></label>
          <select id="billing-country" name="country" class="form-select" required autocomplete="country">
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
