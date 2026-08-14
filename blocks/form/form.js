import createField from './form-fields.js';
import { submitJson } from '../../scripts/submit-json.js';

const DEFAULT_MESSAGES = {
  loadingForm: 'Loading form...',
  invalidFormConfig: 'Form is not configured correctly.',
  missingLinks: 'Add one link to your form JSON and one link to your submit endpoint.',
  loadError: 'Unable to load this form right now.',
  submitting: 'Submitting...',
  success: 'Thanks! Your form was submitted successfully.',
  submitError: 'Something went wrong while submitting. Please try again.',
};

function setFormMessage(form, type, message) {
  let status = form.querySelector('.form-status');
  if (!status) {
    status = document.createElement('p');
    status.className = 'form-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    form.append(status);
  }

  status.dataset.type = type;
  status.textContent = message;
}

function setBlockMessage(block, type, message) {
  const messageEl = document.createElement('p');
  messageEl.className = 'form-block-message';
  messageEl.dataset.type = type;
  messageEl.textContent = message;
  block.replaceChildren(messageEl);
}

function resolveLink(anchor) {
  const href = (anchor.getAttribute('href') || '').trim();
  const text = (anchor.textContent || '').trim();

  // EDS often rewrites external hrefs to same-origin relative paths, or
  // garbles them with URL-encoding. The visible link text always preserves
  // the author's intended URL. Prefer it when it is a valid absolute URL.
  if (/^https?:\/\//i.test(text)) {
    try {
      const parsed = new URL(text);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return text;
      }
    } catch { /* fall through to href */ }
  }

  return href;
}

function extractUrls(block) {
  const urls = [...block.querySelectorAll('a')]
    .map((a) => resolveLink(a))
    .filter(Boolean);

  const formUrl = urls.find((url) => {
    if (!url) return false;
    if (/\.json($|\?)/i.test(url)) return true;
    return /\/query-index($|\.)/i.test(url);
  });

  const submitUrl = urls.find((url) => url && url !== formUrl);
  return { formUrl, submitUrl };
}

function normalizeFormDefinitionUrl(formHref) {
  const inputUrl = new URL(formHref, window.location.origin);

  // Accept DA sheet authoring URLs directly:
  // https://da.live/sheet#/owner/repo/path/to/sheet -> https://da.live/owner/repo/path/to/sheet.json
  if (inputUrl.hostname === 'da.live' && inputUrl.pathname === '/sheet' && inputUrl.hash.startsWith('#/')) {
    const sheetPath = inputUrl.hash.slice(1);
    const normalizedPath = sheetPath.endsWith('.json') ? sheetPath : `${sheetPath}.json`;
    return new URL(normalizedPath, inputUrl.origin);
  }

  // Accept plain sheet path links and auto-append .json.
  if (!/\.json($|\?)/i.test(inputUrl.pathname)) {
    const withJson = `${inputUrl.pathname}.json`;
    return new URL(`${withJson}${inputUrl.search}`, inputUrl.origin);
  }

  return inputUrl;
}

async function fetchFormDefinition(formHref) {
  const url = normalizeFormDefinitionUrl(formHref);
  const resp = await fetch(url.toString());
  if (!resp.ok) {
    throw new Error(`Failed to load form definition: ${resp.status}`);
  }

  return resp.json();
}

function evaluateConditionals(form) {
  const conditionals = form.querySelectorAll('[data-conditional]');
  conditionals.forEach((wrapper) => {
    const rule = wrapper.dataset.conditional;
    if (!rule) return;

    // "fieldName-value" format: show when field with name=fieldName has value selected
    const separatorIdx = rule.lastIndexOf('-');
    if (separatorIdx < 1) return;

    const fieldName = rule.slice(0, separatorIdx);
    const expectedValue = rule.slice(separatorIdx + 1).toLowerCase();

    const matchingInputs = form.querySelectorAll(`[name="${fieldName}"]`);
    let currentValue = '';

    matchingInputs.forEach((input) => {
      if (input.type === 'radio' || input.type === 'checkbox') {
        if (input.checked) currentValue = input.value.toLowerCase();
      } else {
        currentValue = input.value.toLowerCase();
      }
    });

    const shouldShow = currentValue === expectedValue;
    wrapper.hidden = !shouldShow;
    wrapper.querySelectorAll('input, select, textarea').forEach((el) => {
      el.disabled = !shouldShow;
    });
  });
}

async function createForm(formHref, submitHref) {
  const json = await fetchFormDefinition(formHref);
  if (!json?.data || !Array.isArray(json.data)) {
    throw new Error('Form definition does not include a data array.');
  }

  const form = document.createElement('form');
  form.dataset.action = submitHref;
  form.noValidate = true;

  const fields = await Promise.all(json.data.map((fd) => createField(fd, form)));
  fields.forEach((field) => {
    if (field) {
      form.append(field);
    }
  });

  const fieldsets = form.querySelectorAll('fieldset');
  fieldsets.forEach((fieldset) => {
    form.querySelectorAll(`[data-fieldset="${fieldset.name}"`).forEach((field) => {
      fieldset.append(field);
    });
  });

  evaluateConditionals(form);
  form.addEventListener('change', () => evaluateConditionals(form));

  return form;
}

function generatePayload(form) {
  const payload = {};

  [...form.elements].forEach((field) => {
    if (field.name && field.type !== 'submit' && !field.disabled) {
      if (field.type === 'radio') {
        if (field.checked) payload[field.name] = field.value;
      } else if (field.type === 'checkbox') {
        if (field.checked) payload[field.name] = payload[field.name] ? `${payload[field.name]},${field.value}` : field.value;
      } else {
        payload[field.name] = field.value;
      }
    }
  });

  payload.submittedAt = new Date().toISOString();
  payload.pageUrl = window.location.href;

  if (document.referrer) {
    payload.referrer = document.referrer;
  }

  return payload;
}

async function handleSubmit(form) {
  if (form.getAttribute('data-submitting') === 'true') return;

  const submit = form.querySelector('button[type="submit"]');
  const { action } = form.dataset;

  try {
    form.setAttribute('data-submitting', 'true');
    if (submit) submit.disabled = true;
    setFormMessage(form, 'info', DEFAULT_MESSAGES.submitting);

    const payload = generatePayload(form);
    await submitJson(action, payload);

    setFormMessage(form, 'success', DEFAULT_MESSAGES.success);
    form.reset();

    if (form.dataset.confirmation) {
      window.location.href = form.dataset.confirmation;
    }
  } catch (e) {
    setFormMessage(form, 'error', DEFAULT_MESSAGES.submitError);
    console.warn('form: submission failed', e);
  } finally {
    form.setAttribute('data-submitting', 'false');
    if (submit) submit.disabled = false;
  }
}

export default async function decorate(block) {
  const { formUrl, submitUrl } = extractUrls(block);

  const loading = document.createElement('p');
  loading.className = 'form-block-message';
  loading.dataset.type = 'info';
  loading.textContent = DEFAULT_MESSAGES.loadingForm;
  block.replaceChildren(loading);

  if (!formUrl || !submitUrl) {
    setBlockMessage(block, 'error', `${DEFAULT_MESSAGES.invalidFormConfig} ${DEFAULT_MESSAGES.missingLinks}`);
    return;
  }

  let form;
  try {
    form = await createForm(formUrl, submitUrl);
  } catch (error) {
    console.warn('form: unable to create form', error);
    setBlockMessage(block, 'error', DEFAULT_MESSAGES.loadError);
    return;
  }

  block.replaceChildren(form);
  setFormMessage(form, 'info', '');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const valid = form.checkValidity();
    if (valid) {
      handleSubmit(form);
    } else {
      const firstInvalidEl = form.querySelector(':invalid:not(fieldset)');
      const validationMessage = firstInvalidEl?.validationMessage || 'Please complete all required fields.';
      setFormMessage(form, 'error', validationMessage);
      if (firstInvalidEl) {
        firstInvalidEl.focus();
        firstInvalidEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
}
