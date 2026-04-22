export default function decorate(block) {
  const rows = [...block.children];
  
  // Create product card container
  const productCard = document.createElement('div');
  productCard.className = 'product-card-container';
  
  // Initialize product data object
  const productData = {};
  
  // Process each row to extract product information
  rows.forEach((row) => {
    const cells = [...row.children];
    if (cells.length >= 2) {
      const key = cells[0].textContent.trim().toLowerCase().replace(/\s+/g, '');
      const value = cells[1];
      
      switch (key) {
        case 'category':
          productData.category = value.textContent.trim();
          break;
        case 'productname':
          productData.name = value.textContent.trim();
          break;
        case 'productimage':
          const img = value.querySelector('img');
          if (img) {
            productData.image = img.src;
            productData.imageAlt = img.alt || productData.name || 'Product image';
          }
          break;
        case 'productcost':
          productData.price = value.textContent.trim();
          break;
      }
    }
  });
  
  // Create product card HTML structure
  productCard.innerHTML = `
    <div class="product-card">
      <div class="product-image-container">
        <img src="${productData.image || ''}" alt="${productData.imageAlt || 'Product'}" class="product-image" loading="lazy">
      </div>
      <div class="product-info">
        <h3 class="product-name">${productData.name || ''}</h3>
        <div class="product-price">$${formatPrice(productData.price)}</div>
      </div>
    </div>
  `;
  
  // Replace the original block content
  block.innerHTML = '';
  block.appendChild(productCard);
}

// Helper function to format price
function formatPrice(price) {
  if (!price) return '0.00';
  
  // Remove any non-numeric characters except decimal point
  const numericPrice = price.toString().replace(/[^\d.]/g, '');
  const parsed = parseFloat(numericPrice);
  
  if (isNaN(parsed)) return '0.00';
  
  return parsed.toFixed(2);
}
