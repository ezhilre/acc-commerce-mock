/**
 * Decorates the Header Top block
 * Structure: Sign In CTA on the left, Disclaimer on the right
 * @param {Element} block The HeaderTop block element
 */
export default function decorate(block) {
  block.textContent = '';

  const headerTop = document.createElement('div');
  headerTop.classList.add('header-top-inner');

  // Sign In section (left)
  const signInSection = document.createElement('div');
  signInSection.classList.add('header-top-signin');

  const signInLabel = document.createElement('span');
  signInLabel.classList.add('header-top-signin-label');
  signInLabel.textContent = 'Signin CTA';

  const signInBtn = document.createElement('a');
  signInBtn.classList.add('header-top-signin-btn');
  signInBtn.href = '/signin';
  signInBtn.textContent = 'Sign In';
  signInBtn.setAttribute('aria-label', 'Sign In to your account');

  signInSection.append(signInLabel, signInBtn);

  // Disclaimer section (right)
  const disclaimerSection = document.createElement('div');
  disclaimerSection.classList.add('header-top-disclaimer');

  const disclaimerLabel = document.createElement('span');
  disclaimerLabel.classList.add('header-top-disclaimer-label');
  disclaimerLabel.textContent = 'Disclaimer';

  const disclaimerText = document.createElement('span');
  disclaimerText.classList.add('header-top-disclaimer-text');
  disclaimerText.textContent = 'This is a demo website';

  disclaimerSection.append(disclaimerLabel, disclaimerText);

  headerTop.append(signInSection, disclaimerSection);
  block.append(headerTop);
}
