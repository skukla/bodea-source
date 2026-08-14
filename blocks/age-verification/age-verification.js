/**
 * Age Verification Block
 * Simple Yes/No age confirmation overlay.
 * Configurable via key-value rows in DA.live (title, yes/no text, redirect URL).
 * Persists decision in localStorage so the prompt only shows once per browser.
 */

const STORAGE_KEY = 'age_verified';

function cellText(cell) {
  const p = cell.querySelector('p');
  return (p ? p.textContent : cell.textContent || '').trim();
}

function readConfig(block) {
  const cfg = {};

  const rows = Array.from(block.querySelectorAll(':scope > div'));
  rows.forEach((row) => {
    const cells = Array.from(row.children);
    if (cells.length >= 2) {
      const key = cellText(cells[0]).toLowerCase();
      const val = cellText(cells[1]);
      switch (key) {
        case 'title': cfg.title = val; break;
        case 'yes-text': cfg.yesText = val; break;
        case 'no-text': cfg.noText = val; break;
        case 'redirect-url': cfg.redirectUrl = val; break;
        default: break;
      }
    }
  });

  return {
    title: cfg.title || 'Are you 18 or older?',
    yesText: cfg.yesText || 'Yes',
    noText: cfg.noText || 'No',
    redirectUrl: cfg.redirectUrl || 'https://www.google.com',
  };
}

export default function decorate(block) {
  if (localStorage.getItem(STORAGE_KEY) === 'true') {
    block.remove();
    return;
  }

  const {
    title, yesText, noText, redirectUrl,
  } = readConfig(block);

  block.textContent = '';

  const overlay = document.createElement('div');
  overlay.className = 'age-verification-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'age-verification-title');

  const modal = document.createElement('div');
  modal.className = 'age-verification-modal';

  const heading = document.createElement('h2');
  heading.id = 'age-verification-title';
  heading.textContent = title;

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'age-verification-buttons';

  const yesButton = document.createElement('button');
  yesButton.textContent = yesText;
  yesButton.className = 'age-verification-btn age-verification-btn--yes';
  yesButton.addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    block.remove();
    overlay.remove();
    document.body.style.overflow = '';
  });

  const noButton = document.createElement('button');
  noButton.textContent = noText;
  noButton.className = 'age-verification-btn age-verification-btn--no';
  noButton.addEventListener('click', () => {
    window.location.href = redirectUrl;
  });

  buttonGroup.append(yesButton, noButton);
  modal.append(heading, buttonGroup);
  overlay.append(modal);
  block.append(overlay);

  document.body.style.overflow = 'hidden';

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') e.preventDefault();
    if (e.key !== 'Tab') return;
    const focusables = [yesButton, noButton];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  setTimeout(() => yesButton.focus(), 0);
}
