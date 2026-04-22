/**
 * Decorates the header main block with logo, navigation, search, and cart
 * @param {Element} block The header main block element
 */
export default async function decorate(block) {
  // Clear existing content
  block.textContent = '';
  
  // Create main container
  const headerMainContainer = document.createElement('div');
  headerMainContainer.classList.add('headermain-container');

  // Create logo section
  const logoSection = document.createElement('div');
  logoSection.classList.add('headermain-logo');
  
  const logoLink = document.createElement('a');
  logoLink.href = '/';
  logoLink.setAttribute('aria-label', 'Home');
  
  // Check if block contains logo data
  const rows = [...block.children];
  let logoFound = false;
  
  rows.forEach((row) => {
    const cells = [...row.children];
    if (cells.length >= 2) {
      const key = cells[0].textContent.trim();
      const value = cells[1];

      if (key.toLowerCase() === 'logo') {
        logoFound = true;
        const img = value.querySelector('img');
        const picture = value.querySelector('picture');
        
        if (picture) {
          logoLink.appendChild(picture.cloneNode(true));
        } else if (img) {
          logoLink.appendChild(img.cloneNode(true));
        } else {
          const logoText = document.createElement('span');
          logoText.classList.add('logo-text');
          logoText.textContent = value.textContent.trim() || 'Beta Commerce';
          logoLink.appendChild(logoText);
        }
      }
    }
  });
  
  // Default logo if none found
  if (!logoFound) {
    const logoText = document.createElement('span');
    logoText.classList.add('logo-text');
    logoText.textContent = 'Beta Commerce';
    logoLink.appendChild(logoText);
  }
  
  logoSection.appendChild(logoLink);
  headerMainContainer.appendChild(logoSection);

  // Create navigation section
  const navSection = document.createElement('nav');
  navSection.classList.add('headermain-nav');
  
  const navList = document.createElement('ul');
  navList.classList.add('headermain-nav-list');
  
  // Navigation items
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
    link.classList.add('headermain-nav-link');
    listItem.appendChild(link);
    navList.appendChild(listItem);
  });
  
  navSection.appendChild(navList);
  headerMainContainer.appendChild(navSection);

  // Create actions section (search + cart)
  const actionsSection = document.createElement('div');
  actionsSection.classList.add('headermain-actions');
  
  // Search
  const searchForm = document.createElement('form');
  searchForm.classList.add('headermain-search');
  searchForm.setAttribute('role', 'search');
  
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search entire store here...';
  searchInput.classList.add('headermain-search-input');
  searchInput.setAttribute('aria-label', 'Search products');
  
  const searchButton = document.createElement('button');
  searchButton.type = 'submit';
  searchButton.classList.add('headermain-search-button');
  searchButton.setAttribute('aria-label', 'Search');
  searchButton.innerHTML = '🔍';
  
  searchForm.appendChild(searchInput);
  searchForm.appendChild(searchButton);
  
  // Cart
  const cartLink = document.createElement('a');
  cartLink.href = '/cart';
  cartLink.classList.add('headermain-cart');
  cartLink.setAttribute('aria-label', 'Shopping cart');
  
  const cartIcon = document.createElement('span');
  cartIcon.classList.add('headermain-cart-icon');
  cartIcon.innerHTML = '🛒';
  
  const cartCount = document.createElement('span');
  cartCount.classList.add('headermain-cart-count');
  cartCount.textContent = '0';
  
  cartLink.appendChild(cartIcon);
  cartLink.appendChild(cartCount);
  
  actionsSection.appendChild(searchForm);
  actionsSection.appendChild(cartLink);
  headerMainContainer.appendChild(actionsSection);

  // Add the container to the block
  block.appendChild(headerMainContainer);
}
