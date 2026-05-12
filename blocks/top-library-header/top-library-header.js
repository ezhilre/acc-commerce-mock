/**
 * top-library-header block
 *
 * Script tags authored in this block (as HTML-encoded text) are read and injected
 * into <head> early in loadEager() via scripts.js — before block decoration runs.
 * This ensures the scripts load as early as possible without being hardcoded anywhere.
 *
 * Authoring: create a "Top Library Header" table block in the EDS document and
 * paste the raw <script ...></script> tag(s) into the cells. Updating the URL
 * in the document automatically updates what gets injected — no code changes needed.
 *
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  // Script injection is handled early in scripts.js (injectTopLibraryHeaderScripts).
  // This block only needs to ensure the section is hidden from the rendered page.
  const section = block.closest('.section');
  if (section) section.style.display = 'none';
}
