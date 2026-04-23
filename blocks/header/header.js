import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

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
  disclaimerText.textContent = 'This is a demo website used to teach Adobe Experience Platform Data Collection';

  disclaimerSection.append(disclaimerText);

  // Sign In section (RIGHT)
  const signInSection = document.createElement('div');
  signInSection.classList.add('header-top-signin');

  const signInBtn = document.createElement('a');
  signInBtn.classList.add('header-top-signin-btn');
  signInBtn.href = '/signin';
  signInBtn.textContent = 'Sign In';
  signInBtn.setAttribute('aria-label', 'Sign In to your account');

  signInSection.append(signInBtn);

  inner.append(disclaimerSection, signInSection);
  headerTop.append(inner);
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
  
  const picture = document.createElement('picture');

  const sourceWebpDesktop = document.createElement('source');
  sourceWebpDesktop.type = 'image/webp';
  sourceWebpDesktop.srcset = './media_17f794629ab97a4e51b64872cd21db81c627a5c28.jpg?width=2000&format=webply&optimize=medium';
  sourceWebpDesktop.media = '(min-width: 600px)';

  const sourceWebpMobile = document.createElement('source');
  sourceWebpMobile.type = 'image/webp';
  sourceWebpMobile.srcset = './media_17f794629ab97a4e51b64872cd21db81c627a5c28.jpg?width=750&format=webply&optimize=medium';

  const sourceJpegDesktop = document.createElement('source');
  sourceJpegDesktop.type = 'image/jpeg';
  sourceJpegDesktop.srcset = './media_17f794629ab97a4e51b64872cd21db81c627a5c28.jpg?width=2000&format=jpg&optimize=medium';
  sourceJpegDesktop.media = '(min-width: 600px)';

  const logoImg = document.createElement('img');
  logoImg.loading = 'lazy';
  logoImg.alt = 'Beta Commerce Logo';
  logoImg.src = './media_17f794629ab97a4e51b64872cd21db81c627a5c28.jpg?width=750&format=jpg&optimize=medium';
  logoImg.width = 120;
  logoImg.height = 120;
  logoImg.classList.add('luma-logo-img');

  picture.appendChild(sourceWebpDesktop);
  picture.appendChild(sourceWebpMobile);
  picture.appendChild(sourceJpegDesktop);
  picture.appendChild(logoImg);
  logoLink.appendChild(picture);
  
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
