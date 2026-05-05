/**
 * Auth Modal – Sign In / Create Account
 * Provides a reusable modal with two tabs that can be opened from anywhere.
 *
 * Firebase integration:
 *   - Create Account tab calls Firebase Auth + Firestore
 *   - Sign In tab calls Firebase Auth signInWithEmailAndPassword
 *
 * Public API (attached to window.AuthModal):
 *   AuthModal.open(tab?)   – open the modal, optionally on 'signin' or 'create'
 *   AuthModal.close()      – close the modal
 */

import {
  firebaseConfig,
  FIREBASE_SDK_BASE,
  KAFKA_REST_PROXY_BASE,
  KAFKA_SIGNUP_TOPIC,
} from '../../scripts/firebase-config.js';

const MODAL_ID = 'auth-modal-overlay';

// ── Kafka / AWS API Gateway config ────────────────────────────────────────────
// Base URL and topic are defined in scripts/firebase-config.js

/** Full REST Proxy endpoint: POST to this URL to publish a record to the topic */
const KAFKA_REST_PROXY_URL = `${KAFKA_REST_PROXY_BASE}/topics/${KAFKA_SIGNUP_TOPIC}`;

// ── Kafka helpers ─────────────────────────────────────────────────────────────

/**
 * Generate a purely-numeric customer ID (16 digits) that fits the
 * {{RANDOM_UUID_ONLY_NUMBER}} placeholder requirement.
 */
function generateNumericCustomerId() {
  // Combine two Date.now() values with random padding to get a 16-digit number
  const ts = Date.now().toString(); // 13 digits
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0'); // 3 digits
  return ts + rand; // 16 digits
}

/**
 * Build and publish the BETA_COMMERCE_USER_SIGNUP event to Kafka
 * via the AWS API Gateway REST Proxy.
 *
 * @param {{email:string, firstName:string, lastName:string, phone?:string, uid:string}} userData
 * @returns {Promise<void>}
 */
async function publishSignupEventToKafka(userData) {
  const eventPayload = {
    eventType: 'BETA_COMMERCE_USER_SIGNUP',
    timestamp: new Date().toISOString(),
    _id: crypto.randomUUID(),
    SOURCE: 'BETA_COMMERCE',
    user: {
      customerId: generateNumericCustomerId(),
      email: userData.email,
      phone: userData.phone || '',
      firstName: userData.firstName,
      lastName: userData.lastName,
      isEmailVerified: true,
    },
  };

  // ── Kafka REST Proxy expects this envelope format ──────────────────────────
  // POST /topics/<topic>  with Content-Type: application/vnd.kafka.json.v2+json
  const kafkaEnvelope = {
    records: [
      {
        value: eventPayload,
      },
    ],
  };

  console.group('[AuthModal] 🚀 Publishing signup event to Kafka');
  console.log('Topic  :', 'BETA_COMMERCE_USER_SIGNUP');
  console.log('Endpoint:', KAFKA_REST_PROXY_URL);
  console.log('Payload JSON:', JSON.stringify(eventPayload, null, 2));
  console.groupEnd();

  try {
    const response = await fetch(KAFKA_REST_PROXY_URL, {
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
        `[AuthModal] ❌ Kafka publish failed — HTTP ${response.status}:`,
        errorText,
      );
      return;
    }

    const result = await response.json().catch(() => ({}));
    console.group('[AuthModal] ✅ Kafka publish succeeded');
    console.log('HTTP Status :', response.status);
    console.log('Response    :', result);
    console.log('Event sent  :', JSON.stringify(eventPayload, null, 2));
    console.groupEnd();
  } catch (networkErr) {
    console.error('[AuthModal] ❌ Kafka publish – network error:', networkErr);
  }
}

// ── Firebase singleton ───────────────────────────────────────────────────────

let _firebaseApp = null;
let _auth = null;
let _db = null;
let _createUserWithEmailAndPassword = null;
let _signInWithEmailAndPassword = null;
let _signOut = null;
let _onAuthStateChanged = null;
let _doc = null;
let _setDoc = null;

async function getFirebaseServices() {
  if (_auth && _db) {
    return {
      auth: _auth,
      db: _db,
      createUserWithEmailAndPassword: _createUserWithEmailAndPassword,
      signInWithEmailAndPassword: _signInWithEmailAndPassword,
      signOut: _signOut,
      onAuthStateChanged: _onAuthStateChanged,
      doc: _doc,
      setDoc: _setDoc,
    };
  }

  const { initializeApp, getApps } = await import(`${FIREBASE_SDK_BASE}/firebase-app.js`);
  const {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
  } = await import(`${FIREBASE_SDK_BASE}/firebase-auth.js`);
  const { getFirestore, doc, setDoc } = await import(`${FIREBASE_SDK_BASE}/firebase-firestore.js`);

  _firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  _auth = getAuth(_firebaseApp);
  _db = getFirestore(_firebaseApp);
  _createUserWithEmailAndPassword = createUserWithEmailAndPassword;
  _signInWithEmailAndPassword = signInWithEmailAndPassword;
  _signOut = signOut;
  _onAuthStateChanged = onAuthStateChanged;
  _doc = doc;
  _setDoc = setDoc;

  return {
    auth: _auth,
    db: _db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    doc,
    setDoc,
  };
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

const AUTH_COOKIE_NAME = 'auth_user';

function setAuthCookie(user) {
  const data = {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
  };
  // Session cookie (expires when browser closes); add Max-Age for persistence
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(data))}; path=/; SameSite=Strict`;
}

function clearAuthCookie() {
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; Max-Age=0; SameSite=Strict`;
}

function getAuthCookie() {
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.split('=').slice(1).join('=')));
  } catch {
    return null;
  }
}

// ── Helper: generate customer ID ─────────────────────────────────────────────

function generateCustomerId() {
  return `CUST-${crypto.randomUUID()}`;
}

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
  input.autocomplete =
    type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'given-name';

  wrapper.append(label, input);
  return wrapper;
}

/**
 * Show a status message inside a panel.
 * @param {HTMLElement} container  - element that holds the message div
 * @param {string}      message    - text to display
 * @param {'success'|'error'} type - styling variant
 */
function showStatus(container, message, type = 'error') {
  let statusEl = container.querySelector('.auth-modal-status');
  if (!statusEl) {
    statusEl = document.createElement('p');
    statusEl.classList.add('auth-modal-status');
    container.prepend(statusEl);
  }
  statusEl.textContent = message;
  statusEl.className = `auth-modal-status auth-modal-status--${type}`;
}

function clearStatus(container) {
  const statusEl = container.querySelector('.auth-modal-status');
  if (statusEl) statusEl.remove();
}

// ── Sign-In panel ────────────────────────────────────────────────────────────

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

  form.append(makeField('signin-email', 'Email', 'email'), makeField('signin-password', 'Password', 'password'));

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.classList.add('auth-modal-submit');
  submit.textContent = 'Sign In';
  form.appendChild(submit);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearStatus(form);

    const email = form.querySelector('#signin-email').value.trim();
    const password = form.querySelector('#signin-password').value;

    if (!email || !password) {
      showStatus(form, 'Please enter your email and password.', 'error');
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Signing in…';

    try {
      const { auth, signInWithEmailAndPassword } = await getFirebaseServices();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      form.reset();
      // Set auth cookie and close modal immediately
      setAuthCookie(userCredential.user);
      closeModal();

      // ── Push sign-in event to digitalData datalayer ────────────────────
      if (window.digitalData && window.digitalData.setUser) {
        window.digitalData.setUser({
          customerId: userCredential.user.uid || '',
          email: userCredential.user.email || '',
          firstName: userCredential.user.displayName
            ? userCredential.user.displayName.split(' ')[0]
            : '',
          lastName: userCredential.user.displayName
            ? userCredential.user.displayName.split(' ').slice(1).join(' ')
            : '',
          phone: userCredential.user.phoneNumber || '',
          country: '',
          isEmailVerified: userCredential.user.emailVerified || false,
          source: 'BETA_COMMERCE',
          eventId: crypto.randomUUID(),
          eventType: 'BETA_COMMERCE_USER_LOGIN',
        });
      }

      window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: userCredential.user } }));
    } catch (err) {
      console.error('[AuthModal] Sign-in error:', err);
      showStatus(form, friendlyError(err.code), 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Sign In';
    }
  });

  panel.append(heading, form);
  return panel;
}

// ── Create Account panel ─────────────────────────────────────────────────────

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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearStatus(form);

    const firstName = form.querySelector('#create-firstname').value.trim();
    const lastName = form.querySelector('#create-lastname').value.trim();
    const email = form.querySelector('#create-email').value.trim();
    const password = form.querySelector('#create-password').value;

    // Basic validation
    if (!firstName || !lastName || !email || !password) {
      showStatus(form, 'Please fill in all fields.', 'error');
      return;
    }
    if (password.length < 6) {
      showStatus(form, 'Password must be at least 6 characters.', 'error');
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Creating account…';

    try {
      const { auth, db, createUserWithEmailAndPassword, doc, setDoc } = await getFirebaseServices();

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const { user } = userCredential;

      // ── ✅ Firebase Auth success – log details to console ─────────────────
      console.group('[AuthModal] ✅ Firebase signup succeeded');
      console.log('UID            :', user.uid);
      console.log('Email          :', user.email);
      console.log('Email Verified :', user.emailVerified);
      console.log('Display Name   :', user.displayName);
      console.log('Created At     :', user.metadata?.creationTime);
      console.log('Firebase User  :', user);
      console.groupEnd();

      // ✅ Auth succeeded — show success immediately, restore button, reset form
      submit.disabled = false;
      submit.textContent = 'Create Account';
      showStatus(
        form,
        `${firstName} ${lastName}, your account is created and you may log in now.`,
        'success',
      );
      form.reset();

      // ── Push signup event to digitalData datalayer (non-blocking) ────────
      const numericCustomerId = generateNumericCustomerId();
      if (window.digitalData && window.digitalData.setUser) {
        window.digitalData.setUser({
          customerId: numericCustomerId,
          email,
          firstName,
          lastName,
          phone: '',
          country: '',
          isEmailVerified: false,
          source: 'BETA_COMMERCE',
          eventId: crypto.randomUUID(),
          eventType: 'BETA_COMMERCE_USER_SIGNUP',
        });
      }

      // ── Save to Firestore in the background (non-blocking) ────────────────
      const customerId = numericCustomerId;
      setDoc(doc(db, 'users', customerId), {
        customerId,
        uid: user.uid,
        firstName,
        lastName,
        email,
        createdAt: new Date(),
      }).catch((firestoreErr) => {
        console.error('[AuthModal] Firestore write error:', firestoreErr);
      });

      // ── Publish signup event to Kafka via AWS API Gateway (non-blocking) ──
      publishSignupEventToKafka({
        uid: user.uid,
        email,
        firstName,
        lastName,
        phone: '', // phone field not collected in this form; extend makeField if needed
      });
    } catch (err) {
      console.error('[AuthModal] Create account error:', err);
      submit.disabled = false;
      submit.textContent = 'Create Account';
      showStatus(form, friendlyError(err.code), 'error');
    }
  });

  panel.append(heading, form);
  return panel;
}

// ── Friendly Firebase error messages ─────────────────────────────────────────

function friendlyError(code) {
  const map = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
  };
  return map[code] || 'Something went wrong. Please try again.';
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

  return {
    overlay, tabSignIn, tabCreate, signinPanel, createPanel,
  };
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
  const {
    overlay, tabSignIn, tabCreate, signinPanel, createPanel,
  } = ensureModal();

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

// ── Sign Out ─────────────────────────────────────────────────────────────────

async function signOutUser() {
  try {
    const { auth, signOut } = await getFirebaseServices();
    await signOut(auth);
    clearAuthCookie();
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: null } }));
  } catch (err) {
    console.error('[AuthModal] Sign-out error:', err);
  }
}

// ── Subscribe to auth state changes ──────────────────────────────────────────

async function subscribeAuthState(callback) {
  const { auth, onAuthStateChanged } = await getFirebaseServices();
  return onAuthStateChanged(auth, callback);
}

// ── Public API ───────────────────────────────────────────────────────────────

window.AuthModal = {
  open: openModal,
  close: closeModal,
  signOut: signOutUser,
  subscribeAuthState,
  getAuthCookie,
};

// ── Block decorate (AEM EDS entry point) ─────────────────────────────────────

export default function decorate(block) {
  block.style.display = 'none';
  ensureModal();
}

export {
  openModal, closeModal, signOutUser, subscribeAuthState, getAuthCookie,
};
