/**
 * top-library-header block
 *
 * Reads script tags authored in the EDS document (stored as HTML-encoded text,
 * e.g. &#x3C;script src="..."&#x3E;&#x3C;/script&#x3E;) and injects them into
 * <head> so they are not hardcoded anywhere in the codebase.
 *
 * Authoring: create a "Top Library Header" table block in the EDS document and
 * paste the raw <script ...></script> tag(s) into the cells. Updating the URL
 * in the document automatically updates what gets injected — no code changes needed.
 *
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  // Each row cell contains the script tag as HTML-encoded text.
  // cell.textContent returns the decoded string, e.g. <script src="..."></script>
  block.querySelectorAll(':scope > div > div').forEach((cell) => {
    const text = cell.textContent.trim();
    if (!text) return;

    // Parse the decoded text as HTML to extract <script> elements
    const temp = document.createElement('div');
    temp.innerHTML = text;

    temp.querySelectorAll('script').forEach((script) => {
      const newScript = document.createElement('script');
      // Preserve all attributes: src, async, defer, type, etc.
      [...script.attributes].forEach(({ name, value }) => newScript.setAttribute(name, value));
      if (script.textContent.trim()) newScript.textContent = script.textContent;
      document.head.appendChild(newScript);
    });
  });

  // Hide the block's section — it should never render visible content on the page
  const section = block.closest('.section');
  if (section) section.style.display = 'none';
}
