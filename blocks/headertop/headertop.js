/**
 * Decorates the Header Top block - DISABLED to prevent duplicate headers
 * The header top functionality is handled by blocks/header/header.js
 * @param {Element} block The HeaderTop block element
 */
export default function decorate(block) {
  // Clear existing content and do nothing
  // This prevents duplicate top headers since blocks/header/header.js already handles both top and main headers
  block.textContent = '';
  
  // Add a comment to indicate this block is intentionally disabled
  const comment = document.createComment('HeaderTop block disabled - header top handled by header.js');
  block.appendChild(comment);
}
