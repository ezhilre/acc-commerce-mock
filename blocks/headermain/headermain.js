/**
 * Decorates the header main block with logo and category navigation
 * @param {Element} block The header main block element
 */
export default async function decorate(block) {
  // Clear existing content
  block.textContent = '';
  
  // Create main container
  const headerMainContainer = document.createElement('div');
  headerMainContainer.classList.add('headermain-container');

  // Process block rows
  const rows = [...block.children];
  
  rows.forEach((row) => {
    const cells = [...row.children];
    
    if (cells.length >= 2) {
      const key = cells[0].textContent.trim();
      const value = cells[1];

      // Handle Logo
      if (key.toLowerCase() === 'logo') {
        const logoSection = document.createElement('div');
        logoSection.classList.add('headermain-logo');
        
        const logoLink = document.createElement('a');
        logoLink.href = '/';
        logoLink.setAttribute('aria-label', 'Home');
        
        // Check if value contains an image or picture element
        const img = value.querySelector('img');
        const picture = value.querySelector('picture');
        
        if (picture) {
          // Clone the entire picture element with all sources
          logoLink.appendChild(picture.cloneNode(true));
        } else if (img) {
          logoLink.appendChild(img.cloneNode(true));
        } else {
          // Fallback text logo
          const logoText = document.createElement('span');
          logoText.classList.add('logo-text');
          logoText.textContent = value.textContent.trim() || 'Beta Commerce';
          logoLink.appendChild(logoText);
        }
        
        logoSection.appendChild(logoLink);
        headerMainContainer.appendChild(logoSection);
      }
      // Handle navigation categories
      else if (key.toLowerCase().includes('category') || 
               key.toLowerCase() === 'men' || 
               key.toLowerCase() === 'women' || 
               key.toLowerCase() === 'car') {
        const navItem = document.createElement('div');
        navItem.classList.add('headermain-nav-item');
        
        const link = document.createElement('a');
        const linkText = value.textContent.trim();
        
        // Determine the href based on the category - use full URLs as specified
        if (linkText.toLowerCase() === 'men') {
          link.href = 'https://main--acc-commerce-mock--ezhilre.aem.live/men';
        } else if (linkText.toLowerCase() === 'women') {
          link.href = 'https://main--acc-commerce-mock--ezhilre.aem.live/women';
        } else if (linkText.toLowerCase().includes('car') || linkText.toLowerCase().includes('motorbike')) {
          link.href = '/car-motorbike';
        } else {
          // Generic fallback for other categories
          link.href = `/${linkText.toLowerCase().replace(/\s+/g, '-')}`;
        }
        
        link.textContent = linkText;
        link.classList.add('headermain-nav-link');
        
        navItem.appendChild(link);
        headerMainContainer.appendChild(navItem);
      }
    }
  });

  // Add the container to the block
  block.appendChild(headerMainContainer);
}
