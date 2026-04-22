/**
 * Decorates the header main block - DISABLED to prevent duplicate headers
 * The main header functionality is handled by blocks/header/header.js
 * @param {Element} block The header main block element
 */
export default async function decorate(block) {
  // Clear existing content and do nothing
  // This prevents duplicate headers since blocks/header/header.js already handles both top and main headers
  block.textContent = '';
  
  // Add a comment to indicate this block is intentionally disabled
  const comment = document.createComment('HeaderMain block disabled - main header handled by header.js');
  block.appendChild(comment);
}
