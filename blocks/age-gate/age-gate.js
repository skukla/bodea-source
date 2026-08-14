/**
 * Age Gate Block
 * Full date-of-birth verification overlay.
 * Configurable via key-value rows in DA.live (min age, title, messages, etc.).
 * Persists decision in localStorage + cookie so the gate only shows once.
 */

const DECISION_KEY = 'age_gate_decision';

function calculateAge(dob) {
  const diff = Date.now() - dob.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function setCookie(name, value, days) {
  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = `; expires=${date.toUTCString()}`;
  }
  document.cookie = `${name}=${value || ''}${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i += 1) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
  }
  return null;
}

function trapFocus(container, focusables) {
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

function cellText(cell) {
  const p = cell.querySelector('p');
  return (p ? p.textContent : cell.textContent || '').trim();
}

function readConfig(block) {
  const cfg = {
    minAge: block.dataset.minAge,
    storageDuration: block.dataset.storageDuration,
    title: block.dataset.title,
    message: block.dataset.message,
    monthPlaceholder: block.dataset.monthPlaceholder,
    dayPlaceholder: block.dataset.dayPlaceholder,
    yearPlaceholder: block.dataset.yearPlaceholder,
    buttonText: block.dataset.buttonText,
    errorMessage: block.dataset.errorMessage,
  };

  const rows = Array.from(block.querySelectorAll(':scope > div'));
  rows.forEach((row) => {
    const cells = Array.from(row.children);
    if (cells.length >= 2) {
      const key = cellText(cells[0]).toLowerCase();
      const val = cellText(cells[1]);
      switch (key) {
        case 'data-min-age': cfg.minAge ??= val; break;
        case 'data-storage-duration': cfg.storageDuration ??= val; break;
        case 'data-title': cfg.title ??= val; break;
        case 'data-message': cfg.message ??= val; break;
        case 'data-month-placeholder': cfg.monthPlaceholder ??= val; break;
        case 'data-day-placeholder': cfg.dayPlaceholder ??= val; break;
        case 'data-year-placeholder': cfg.yearPlaceholder ??= val; break;
        case 'data-button-text': cfg.buttonText ??= val; break;
        case 'data-error-message': cfg.errorMessage ??= val; break;
        default: break;
      }
    }
  });

  const minAge = parseInt(cfg.minAge || '18', 10);
  return {
    minAge,
    storageDuration: parseInt(cfg.storageDuration || '30', 10),
    title: cfg.title || 'Age Verification',
    message: cfg.message || 'Please enter your date of birth to continue.',
    monthPlaceholder: cfg.monthPlaceholder || 'MM',
    dayPlaceholder: cfg.dayPlaceholder || 'DD',
    yearPlaceholder: cfg.yearPlaceholder || 'YYYY',
    buttonText: cfg.buttonText || 'Submit',
    errorMessage: cfg.errorMessage || `You must be at least ${minAge} years old to view this content.`,
  };
}

export default async function decorate(block) {
  const decision = localStorage.getItem(DECISION_KEY) || getCookie(DECISION_KEY);
  if (decision === 'true') {
    block.remove();
    return;
  }

  const {
    minAge,
    storageDuration,
    title,
    message,
    monthPlaceholder,
    dayPlaceholder,
    yearPlaceholder,
    buttonText,
    errorMessage,
  } = readConfig(block);

  block.innerHTML = '';

  const overlay = document.createElement('div');
  overlay.className = 'age-gate-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'age-gate-title');

  const modal = document.createElement('div');
  modal.className = 'age-gate-modal';
  modal.innerHTML = `
    <h2 id="age-gate-title">${title}</h2>
    <p>${message}</p>
    <div class="age-gate-form">
      <input type="text" id="age-gate-month" placeholder="${monthPlaceholder}" inputmode="numeric" maxlength="2" aria-label="Month">
      <input type="text" id="age-gate-day" placeholder="${dayPlaceholder}" inputmode="numeric" maxlength="2" aria-label="Day">
      <input type="text" id="age-gate-year" placeholder="${yearPlaceholder}" inputmode="numeric" maxlength="4" aria-label="Year">
    </div>
    <p class="age-gate-error" style="display:none"></p>
    <button type="button" class="age-gate-button">${buttonText}</button>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const monthInput = modal.querySelector('#age-gate-month');
  const dayInput = modal.querySelector('#age-gate-day');
  const yearInput = modal.querySelector('#age-gate-year');
  const submitButton = modal.querySelector('.age-gate-button');
  const errorElement = modal.querySelector('.age-gate-error');

  trapFocus(overlay, [monthInput, dayInput, yearInput, submitButton]);
  setTimeout(() => monthInput.focus(), 0);

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') e.preventDefault();
  });

  function showError(text) {
    errorElement.textContent = text;
    errorElement.style.display = 'block';
  }

  function clearError() {
    errorElement.textContent = '';
    errorElement.style.display = 'none';
  }

  submitButton.addEventListener('click', () => {
    clearError();

    const month = parseInt(monthInput.value, 10);
    const day = parseInt(dayInput.value, 10);
    const year = parseInt(yearInput.value, 10);

    if (
      !Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(year)
      || month < 1 || month > 12
      || day < 1 || day > 31
      || year <= 1900 || year > new Date().getFullYear()
    ) {
      showError('Please enter a valid date.');
      return;
    }

    const dob = new Date(year, month - 1, day);
    if (dob.getMonth() !== month - 1 || dob.getDate() !== day || dob.getFullYear() !== year) {
      showError('Please enter a valid date.');
      return;
    }

    if (calculateAge(dob) >= minAge) {
      localStorage.setItem(DECISION_KEY, 'true');
      setCookie(DECISION_KEY, 'true', storageDuration);
      block.remove();
      overlay.remove();
      document.body.style.overflow = previousOverflow || '';
    } else {
      showError(errorMessage);
    }
  });
}
