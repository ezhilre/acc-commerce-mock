/**
 * Decorates the Header Top block.
 * Reads values from the EDS block rows:
 *   Row 0 → Disclaimer (key / value) — rendered on the LEFT
 *   Row 1 → Sign In CTA (label / link text) — rendered on the RIGHT
 *
 * @param {Element} block The HeaderTop block element
 */
export default function decorate(block) {
  // Collect the two rows authored in the EDS document
  const rows = [...block.querySelectorAll(':scope > div')];

  const [disclaimerRow, signInRow] = rows;

  // Parse disclaimer row  →  key: first div, value: second div
  const disclaimerCells = disclaimerRow
    ? [...disclaimerRow.querySelectorAll(':scope > div')]
    : [];
  const disclaimerKey = disclaimerCells[0]?.textContent.trim() || 'Disclaimer';
  const disclaimerValue = disclaimerCells[1]?.textContent.trim() || '';

  // Parse sign-in row  →  label: first div, link text: second div
  const signInCells = signInRow
    ? [...signInRow.querySelectorAll(':scope > div')]
    : [];
  const signInLabelText = signInCells[0]?.textContent.trim() || 'Signin CTA';
  const signInLinkText = signInCells[1]?.textContent.trim() || 'Sign In';

  // Clear authored markup — we replace it with semantic HTML
  block.textContent = '';

  const headerTop = document.createElement('div');
  headerTop.classList.add('header-top-inner');

  // ── Disclaimer section (LEFT) ──────────────────────────────
  const disclaimerSection = document.createElement('div');
  disclaimerSection.classList.add('header-top-disclaimer');

  const disclaimerLabel = document.createElement('span');
  disclaimerLabel.classList.add('header-top-disclaimer-label');
  disclaimerLabel.textContent = disclaimerKey;

  const disclaimerText = document.createElement('span');
  disclaimerText.classList.add('header-top-disclaimer-text');
  disclaimerText.textContent = disclaimerValue;

  disclaimerSection.append(disclaimerLabel, disclaimerText);

  // ── Sign In section (RIGHT) ────────────────────────────────
  const signInSection = document.createElement('div');
  signInSection.classList.add('header-top-signin');

  const signInLabel = document.createElement('span');
  signInLabel.classList.add('header-top-signin-label');
  signInLabel.textContent = signInLabelText;

  const signInBtn = document.createElement('a');
  signInBtn.classList.add('header-top-signin-btn');
  signInBtn.href = '/signin';
  signInBtn.textContent = signInLinkText;
  signInBtn.setAttribute('aria-label', 'Sign In to your account');

  signInSection.append(signInLabel, signInBtn);

  // Disclaimer LEFT, Sign In RIGHT
  headerTop.append(disclaimerSection, signInSection);
  block.append(headerTop);
}
