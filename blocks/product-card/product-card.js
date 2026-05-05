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
    if (cells.length >= 1) {
      const key = cells[0].textContent.trim().toLowerCase().replace(/\s+/g, '');
      const value = cells[1];

      // Detect SKU pattern: key like "sku-xxx-xx-xx" (starts with 'sku')
      if (/^sku[-_]/.test(key) || /^sku\d/.test(key)) {
        // The full SKU is in the first cell text (original casing)
        productData.sku = cells[0].textContent.trim();
        return;
      }

      if (!value) return;

      switch (key) {
        case 'category':
          productData.category = value.textContent.trim();
          break;
        case 'productname':
          productData.name = value.textContent.trim();
          break;
        case 'productimage': {
          const img = value.querySelector('img');
          if (img) {
            productData.image = img.src;
            productData.imageAlt = img.alt || productData.name || 'Product image';
          }
          break;
        }
        case 'productcost':
          productData.price = value.textContent.trim();
          break;
        default:
          break;
      }
    }
  });

  const formattedPrice = formatPrice(productData.price);

  // Create product card HTML structure
  productCard.innerHTML = `
    <div class="product-card-inner">
      <div class="product-image-container">
        <img src="${productData.image || ''}" alt="${productData.imageAlt || 'Product'}" class="product-image" loading="lazy">
      </div>
      <div class="product-info">
        <h3 class="product-name">${productData.name || ''}</h3>
        <div class="product-price">₹${formattedPrice}</div>
        ${productData.sku ? `<div class="product-sku">SKU: ${productData.sku}</div>` : ''}
        <button
          class="add-to-cart-btn"
          type="button"
          data-product-name="${productData.name || ''}"
          data-product-price="${formattedPrice}"
          data-product-sku="${productData.sku || ''}"
          data-product-image="${productData.image || ''}"
        >
          Add to Cart
        </button>
      </div>
    </div>
  `;

  // Wire up Add to Cart button
  const btn = productCard.querySelector('.add-to-cart-btn');
  btn.addEventListener('click', () => {
    const cartDetail = {
      sku: productData.sku || `SKU-${Date.now()}`,
      name: productData.name || 'Unknown Product',
      price: formattedPrice,
      image: productData.image || '',
      category: productData.category || '',
      quantity: 1,
      timestamp: new Date().toISOString(),
    };

    // Push directly to digitalData datalayer if available
    if (window.digitalData && window.digitalData.pushAddToCart) {
      window.digitalData.pushAddToCart(cartDetail);
    }

    const event = new CustomEvent('addToCart', {
      bubbles: true,
      detail: cartDetail,
    });
    btn.dispatchEvent(event);

    // Visual feedback
    btn.textContent = '✓ Added!';
    btn.style.background = '#2e7d32';
    setTimeout(() => {
      btn.textContent = 'Add to Cart';
      btn.style.background = '';
    }, 1500);
  });

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

  if (Number.isNaN(parsed)) return '0.00';

  return parsed.toFixed(2);
}
