/**
 * Auth Modal – Sign In / Create Account
 * Provides a reusable modal with two tabs that can be opened from anywhere.
 *
 * Public API (attached to window.AuthModal):
 *   AuthModal.open(tab?)   – open the modal, optionally on 'signin' or 'create'
 *   AuthModal.close()      – close the modal
 */

const MODAL_ID = 'auth-modal-overlay';

// ── Build helpers ────────────────────────────────────────────────────────────

function makeField(id, labelText, type = 'text') {
  const wrapper = document.createElement('div');
  wrapper.classList.add('auth-modal-field');

  const label = document.createElement('label');
  label.setAttribute('for', id);
  label.textContent = labelText;

  const input = document.createElement('input');
  input.type = type;
  input.id = id;
  input.name = id;
  input.autocomplete = type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'given-name';

  wrapper.append(label, input);
  return wrapper;
}

function buildSignInPanel() {
  const panel = document.createElement('div');
  panel.classList.add('auth-modal-panel', 'is-active');
  panel.id = 'auth-panel-signin';
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', 'auth-tab-signin');

  const heading = document.createElement('h2');
  heading.textContent = 'Sign In';

  const form = document.createElement('form');
  form.classList.add('auth-modal-form');
  form.noValidate = true;

  form.append(
    makeField('signin-email', 'Email', 'email'),
    makeField('signin-password', 'Password', 'password'),
  );

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.classList.add('auth-modal-submit');
  submit.textContent = 'Sign In';

  form.appendChild(submit);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // TODO: integrate with real auth
    console.log('Sign In submitted');
  });

  panel.append(heading, form);
  return panel;
}

function buildCreateAccountPanel() {
  const panel = document.createElement('div');
  panel.classList.add('auth-modal-panel');
  panel.id = 'auth-panel-create';
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', 'auth-tab-create');

  const heading = document.createElement('h2');
  heading.textContent = 'Create Account';

  const form = document.createElement('form');
  form.classList.add('auth-modal-form');
  form.noValidate = true;

  form.append(
    makeField('create-firstname', 'First Name', 'text'),
    makeField('create-lastname', 'Last Name', 'text'),
    makeField('create-email', 'Email', 'email'),
    makeField('create-password', 'Password', 'password'),
  );

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.classList.add('auth-modal-submit');
  submit.textContent = 'Create Account';

  form.appendChild(submit);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // TODO: integrate with real auth
    console.log('Create Account submitted');
  });

  panel.append(heading, form);
  return panel;
}

// ── Build the full modal DOM ─────────────────────────────────────────────────

function buildModal() {
  // Load CSS if not already present
  if (!document.querySelector('link[href*="auth-modal"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/blocks/auth-modal/auth-modal.css';
    document.head.appendChild(link);
  }

  // Overlay
  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.classList.add('auth-modal-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Sign In or Create Account');

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Modal box
  const modal = document.createElement('div');
  modal.classList.add('auth-modal');

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.classList.add('auth-modal-close');
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', closeModal);

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.classList.add('auth-modal-tabs');
  tabBar.setAttribute('role', 'tablist');

  const tabSignIn = document.createElement('button');
  tabSignIn.classList.add('auth-modal-tab', 'is-active');
  tabSignIn.id = 'auth-tab-signin';
  tabSignIn.setAttribute('role', 'tab');
  tabSignIn.setAttribute('aria-selected', 'true');
  tabSignIn.setAttribute('aria-controls', 'auth-panel-signin');
  tabSignIn.textContent = 'Sign In';

  const tabCreate = document.createElement('button');
  tabCreate.classList.add('auth-modal-tab');
  tabCreate.id = 'auth-tab-create';
  tabCreate.setAttribute('role', 'tab');
  tabCreate.setAttribute('aria-selected', 'false');
  tabCreate.setAttribute('aria-controls', 'auth-panel-create');
  tabCreate.textContent = 'Create Account';

  tabBar.append(tabSignIn, tabCreate);

  // Panels
  const signinPanel = buildSignInPanel();
  const createPanel = buildCreateAccountPanel();

  // Tab switching
  function switchTab(activeTab, activePanel, inactiveTab, inactivePanel) {
    activeTab.classList.add('is-active');
    activeTab.setAttribute('aria-selected', 'true');
    activePanel.classList.add('is-active');
    inactiveTab.classList.remove('is-active');
    inactiveTab.setAttribute('aria-selected', 'false');
    inactivePanel.classList.remove('is-active');
  }

  tabSignIn.addEventListener('click', () => switchTab(tabSignIn, signinPanel, tabCreate, createPanel));
  tabCreate.addEventListener('click', () => switchTab(tabCreate, createPanel, tabSignIn, signinPanel));

  modal.append(closeBtn, tabBar, signinPanel, createPanel);
  overlay.appendChild(modal);

  return { overlay, tabSignIn, tabCreate, signinPanel, createPanel };
}

// ── Open / Close logic ───────────────────────────────────────────────────────

let _refs = null;

function ensureModal() {
  if (!_refs) {
    _refs = buildModal();
    document.body.appendChild(_refs.overlay);

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }
  return _refs;
}

function openModal(tab = 'signin') {
  const { overlay, tabSignIn, tabCreate, signinPanel, createPanel } = ensureModal();

  // Select the right tab
  if (tab === 'create') {
    tabCreate.classList.add('is-active');
    tabCreate.setAttribute('aria-selected', 'true');
    createPanel.classList.add('is-active');
    tabSignIn.classList.remove('is-active');
    tabSignIn.setAttribute('aria-selected', 'false');
    signinPanel.classList.remove('is-active');
  } else {
    tabSignIn.classList.add('is-active');
    tabSignIn.setAttribute('aria-selected', 'true');
    signinPanel.classList.add('is-active');
    tabCreate.classList.remove('is-active');
    tabCreate.setAttribute('aria-selected', 'false');
    createPanel.classList.remove('is-active');
  }

  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';

  // Focus the first input in the active panel
  const activePanel = tab === 'create' ? createPanel : signinPanel;
  const firstInput = activePanel.querySelector('input');
  if (firstInput) setTimeout(() => firstInput.focus(), 50);
}

function closeModal() {
  const overlay = document.getElementById(MODAL_ID);
  if (overlay) {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

window.AuthModal = { open: openModal, close: closeModal };

// ── Block decorate (AEM EDS entry point) ─────────────────────────────────────

export default function decorate(block) {
  // This block has no visible content – it just registers the modal.
  // The modal is triggered externally via window.AuthModal.open()
  block.style.display = 'none';
  ensureModal();
}

export { openModal, closeModal };
