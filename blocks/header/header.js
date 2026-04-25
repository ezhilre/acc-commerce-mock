import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { openModal, signOutUser, subscribeAuthState, getAuthCookie } from '../auth-modal/auth-modal.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  if (!sections) return;
  sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', expanded);
  });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  // enable nav dropdown keyboard accessibility
  if (navSections) {
    const navDrops = navSections.querySelectorAll('.nav-drop');
    if (isDesktop.matches) {
      navDrops.forEach((drop) => {
        if (!drop.hasAttribute('tabindex')) {
          drop.setAttribute('tabindex', 0);
          drop.addEventListener('focus', focusNavSection);
        }
      });
    } else {
      navDrops.forEach((drop) => {
        drop.removeAttribute('tabindex');
        drop.removeEventListener('focus', focusNavSection);
      });
    }
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

// ── Logged-off toast ────────────────────────────────────────────────────────

function showLoggedOffToast() {
  let toast = document.getElementById('loggedoff-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'loggedoff-toast';
    toast.style.cssText = `
      position:fixed; top:60px; right:24px; z-index:9999;
      background:#1a1a2e; color:#fff; padding:12px 24px;
      border-radius:6px; font-size:14px; font-weight:600;
      box-shadow:0 4px 12px rgba(0,0,0,0.3);
      opacity:0; transition:opacity 0.3s ease;
      pointer-events:none;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = '👋 You have been logged off successfully.';
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// ── My Account panel ────────────────────────────────────────────────────────

function showMyAccountPanel(user) {
  let panel = document.getElementById('my-account-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'my-account-panel';
    panel.style.cssText = `
      position:fixed; top:0; right:0; width:320px; height:100vh;
      background:#fff; z-index:10000; box-shadow:-4px 0 20px rgba(0,0,0,0.2);
      padding:32px 24px; transform:translateX(100%);
      transition:transform 0.3s ease; overflow-y:auto;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      position:absolute; top:16px; right:16px;
      background:none; border:none; font-size:24px;
      cursor:pointer; color:#666; line-height:1;
    `;
    closeBtn.addEventListener('click', () => {
      panel.style.transform = 'translateX(100%)';
    });

    const title = document.createElement('h2');
    title.id = 'my-account-title';
    title.style.cssText = 'font-size:1.25rem; font-weight:700; color:#1a1a2e; margin-bottom:24px; border-bottom:2px solid #ff5722; padding-bottom:8px;';
    title.textContent = 'My Account';

    const content = document.createElement('div');
    content.id = 'my-account-content';
    content.style.cssText = 'display:flex; flex-direction:column; gap:12px;';

    panel.append(closeBtn, title, content);
    document.body.appendChild(panel);

    // Close on backdrop click (outside panel)
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && !e.target.closest('#my-account-link')) {
        panel.style.transform = 'translateX(100%)';
      }
    });
  }

  // Populate with user info
  const content = panel.querySelector('#my-account-content');
  content.innerHTML = '';

  function row(label, value) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'background:#f8f9fa; border-radius:6px; padding:12px 16px;';
    wrap.innerHTML = `<div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">${label}</div>
      <div style="font-size:14px;font-weight:600;color:#1a1a2e;word-break:break-all;">${value}</div>`;
    return wrap;
  }

  content.append(
    row('Email', user.email || '—'),
    row('User ID', user.uid ? `${user.uid.substring(0, 12)}…` : '—'),
    row('Account Created', user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'),
    row('Last Sign In', user.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'),
    row('Email Verified', user.emailVerified ? '✅ Yes' : '❌ No'),
  );

  panel.style.transform = 'translateX(0)';
}

// ── Auth state update ────────────────────────────────────────────────────────

function updateHeaderAuth(user) {
  const signInSection = document.querySelector('.header-top-signin');
  if (!signInSection) return;

  signInSection.innerHTML = '';

  if (user) {
    // Show email
    const userEmail = document.createElement('span');
    userEmail.style.cssText = 'color:#f4a261; font-size:12px; margin-right:10px;';
    userEmail.textContent = user.email;

    // My Account link
    const myAccountLink = document.createElement('button');
    myAccountLink.id = 'my-account-link';
    myAccountLink.classList.add('header-top-signin-btn');
    myAccountLink.style.cssText = 'background:#f4a261; margin-right:8px;';
    myAccountLink.textContent = 'My Account';
    myAccountLink.setAttribute('aria-label', 'My Account');
    myAccountLink.addEventListener('click', (e) => {
      e.stopPropagation();
      showMyAccountPanel(user);
    });

    // Sign Out button
    const signOutBtn = document.createElement('button');
    signOutBtn.classList.add('header-top-signin-btn');
    signOutBtn.textContent = 'Sign Out';
    signOutBtn.setAttribute('aria-label', 'Sign out of your account');
    signOutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await signOutUser();
    });

    signInSection.append(userEmail, myAccountLink, signOutBtn);
  } else {
    // Sign In button
    const signInBtn = document.createElement('button');
    signInBtn.classList.add('header-top-signin-btn');
    signInBtn.textContent = 'Sign In';
    signInBtn.setAttribute('aria-label', 'Sign In to your account');
    signInBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('signin');
    });
    signInSection.append(signInBtn);
  }
}

/**
 * Builds and returns the header-top bar (Disclaimer left, Sign In right)
 * @returns {HTMLElement}
 */
function buildHeaderTop() {
  const headerTop = document.createElement('div');
  headerTop.classList.add('header-top');

  const inner = document.createElement('div');
  inner.classList.add('header-top-inner');

  // Disclaimer section (LEFT)
  const disclaimerSection = document.createElement('div');
  disclaimerSection.classList.add('header-top-disclaimer');

  const disclaimerText = document.createElement('span');
  disclaimerText.classList.add('header-top-disclaimer-text');
  disclaimerText.textContent = 'This is a just a demo website for Adobe Commerce and does not process any real orders.';

  disclaimerSection.append(disclaimerText);

  // Auth section (RIGHT) — starts with Sign In, updated by Firebase auth state
  const signInSection = document.createElement('div');
  signInSection.classList.add('header-top-signin');

  const signInBtn = document.createElement('button');
  signInBtn.classList.add('header-top-signin-btn');
  signInBtn.textContent = 'Sign In';
  signInBtn.setAttribute('aria-label', 'Sign In to your account');
  signInBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('signin');
  });

  signInSection.append(signInBtn);

  inner.append(disclaimerSection, signInSection);
  headerTop.append(inner);

  // Immediately apply cookie-based auth state so the header is correct before Firebase resolves
  const cookieUser = getAuthCookie();
  if (cookieUser) {
    updateHeaderAuth(cookieUser);
  }

  // Subscribe to Firebase auth state — updates header when Firebase resolves
  subscribeAuthState((user) => {
    updateHeaderAuth(user);
    // Keep cookie in sync: clear it if Firebase says no user
    if (!user) {
      document.cookie = 'auth_user=; path=/; Max-Age=0; SameSite=Strict';
    }
  });

  // Listen for custom authStateChanged events (sign-in / sign-out dispatched manually)
  window.addEventListener('authStateChanged', (e) => {
    if (!e.detail.user) {
      showLoggedOffToast();
    }
    updateHeaderAuth(e.detail.user);
  });

  return headerTop;
}

/**
 * Builds and returns the Luma-style main navigation
 * @returns {HTMLElement}
 */
function buildLumaMainNav() {
  const mainNav = document.createElement('div');
  mainNav.classList.add('luma-main-nav');

  const container = document.createElement('div');
  container.classList.add('luma-nav-container');

  // Logo section
  const logoSection = document.createElement('div');
  logoSection.classList.add('luma-logo');
  
  const logoLink = document.createElement('a');
  logoLink.href = '/';
  logoLink.setAttribute('aria-label', 'Home');
  
  const logoSvgWrapper = document.createElement('div');
  logoSvgWrapper.classList.add('luma-logo-svg');
  logoSvgWrapper.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" width="200" height="60" role="img" aria-label="Beta Commerce">
      <!-- Shopping bag icon -->
      <g transform="translate(4, 4)">
        <rect x="2" y="16" width="28" height="26" rx="3" ry="3" fill="#ff5722" />
        <path d="M8 16 C8 9 24 9 24 16" fill="none" stroke="#ff5722" stroke-width="3" stroke-linecap="round"/>
        <line x1="11" y1="24" x2="21" y2="24" stroke="white" stroke-width="2" stroke-linecap="round"/>
        <line x1="16" y1="19" x2="16" y2="29" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </g>
      <!-- Brand name -->
      <text x="46" y="28" font-family="Arial, sans-serif" font-size="16" font-weight="800" fill="#1a1a2e" letter-spacing="1">BETA</text>
      <text x="46" y="48" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#ff5722" letter-spacing="2">COMMERCE</text>
    </svg>
  `;
  logoLink.appendChild(logoSvgWrapper);
  
  logoSection.appendChild(logoLink);
  container.appendChild(logoSection);

  // Navigation section
  const navSection = document.createElement('nav');
  navSection.classList.add('luma-nav');
  
  const navList = document.createElement('ul');
  navList.classList.add('luma-nav-list');
  
  const navItems = [
    { text: 'WHAT\'S NEW', href: '/whats-new' },
    { text: 'WOMEN', href: 'https://main--acc-commerce-mock--ezhilre.aem.live/women' },
    { text: 'MEN', href: 'https://main--acc-commerce-mock--ezhilre.aem.live/men' },
    { text: 'GEAR', href: '/gear' },
    { text: 'TRAINING', href: '/training' },
    { text: 'SALE', href: '/sale' }
  ];
  
  navItems.forEach(item => {
    const listItem = document.createElement('li');
    const link = document.createElement('a');
    link.href = item.href;
    link.textContent = item.text;
    link.classList.add('luma-nav-link');
    listItem.appendChild(link);
    navList.appendChild(listItem);
  });
  
  navSection.appendChild(navList);
  container.appendChild(navSection);

  // Actions section (search + cart)
  const actionsSection = document.createElement('div');
  actionsSection.classList.add('luma-actions');
  
  // Search
  const searchForm = document.createElement('form');
  searchForm.classList.add('luma-search');
  searchForm.setAttribute('role', 'search');
  
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search entire store here...';
  searchInput.classList.add('luma-search-input');
  searchInput.setAttribute('aria-label', 'Search products');
  
  const searchButton = document.createElement('button');
  searchButton.type = 'submit';
  searchButton.classList.add('luma-search-button');
  searchButton.setAttribute('aria-label', 'Search');
  searchButton.innerHTML = '🔍';
  
  searchForm.appendChild(searchInput);
  searchForm.appendChild(searchButton);
  
  // Cart
  const cartLink = document.createElement('a');
  cartLink.href = '/cart';
  cartLink.classList.add('luma-cart');
  cartLink.setAttribute('aria-label', 'Shopping cart');
  
  const cartIcon = document.createElement('span');
  cartIcon.classList.add('luma-cart-icon');
  cartIcon.innerHTML = '🛒';
  
  const cartCount = document.createElement('span');
  cartCount.classList.add('luma-cart-count');
  cartCount.textContent = '0';
  
  cartLink.appendChild(cartIcon);
  cartLink.appendChild(cartCount);
  
  actionsSection.appendChild(searchForm);
  actionsSection.appendChild(cartLink);
  container.appendChild(actionsSection);

  mainNav.appendChild(container);
  return mainNav;
}

/**
 * loads and decorates the header with Luma-style layout
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // Clear block content
  block.textContent = '';

  // Build the complete header structure
  block.append(buildHeaderTop(), buildLumaMainNav());
}
