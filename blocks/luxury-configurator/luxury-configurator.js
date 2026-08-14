import { initializers } from '@dropins/tools/initializer.js';
import { events } from '@dropins/tools/event-bus.js';
import {
  fetchProductData,
  getProductConfigurationValues,
  initialize,
  isProductConfigurationValid,
  setEndpoint,
  setProductConfigurationValues,
} from '@dropins/storefront-pdp/api.js';
import ProductOptions from '@dropins/storefront-pdp/containers/ProductOptions.js';
import { render as pdpRender } from '@dropins/storefront-pdp/render.js';

import '../../scripts/initializers/cart.js';

import { readBlockConfig } from '../../scripts/aem.js';
import {
  CS_FETCH_GRAPHQL,
  fetchPlaceholders,
  getOptionsUIDsFromUrl,
  getProductLink,
  rootLink,
} from '../../scripts/commerce.js';

const DEFAULTS = {
  title: 'Bespoke Configuration Studio',
  eyebrow: 'Private Configuration Studio',
  description: 'Select your finish, material, and signature details. This experience refines a live Adobe Commerce product as you curate the final configuration.',
  theme: 'obsidian',
  layout: 'split-editorial',
  showSummary: true,
  showPrice: true,
  showGallery: true,
  showSpecHighlights: true,
  ctaLabel: 'Add configured product to cart',
  pdpLinkLabel: 'View full details',
  conciergeLabel: 'Book concierge',
  conciergeHref: '/support',
  attributeGroups: '',
};

const THEMES = new Set(['obsidian', 'emerald', 'ivory']);
const LAYOUTS = new Set(['split-editorial', 'stacked-gallery']);
const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * @param {string|boolean|number|null|undefined} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
function parseBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === '' || value === null || value === undefined) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', 'yes', '1', 'on'].includes(normalized)) return true;
  if (['false', 'no', '0', 'off'].includes(normalized)) return false;
  return fallback;
}

/**
 * @param {string|null|undefined} html
 * @returns {string}
 */
function toPlainText(html) {
  if (!html) return '';
  const parsed = new DOMParser().parseFromString(String(html), 'text/html');
  return parsed.body.textContent?.replace(/\s+/g, ' ').trim() || '';
}

/**
 * @param {string|null|undefined} value
 * @param {Set<string>} allowedValues
 * @param {string} fallback
 * @returns {string}
 */
function normalizeEnum(value, allowedValues, fallback) {
  const normalized = normalizeToken(value);
  return allowedValues.has(normalized) ? normalized : fallback;
}

/**
 * @param {string|null|undefined} value
 * @returns {string}
 */
function resolveSafeHref(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (raw.startsWith('/')) {
    return rootLink(raw);
  }

  if (raw.startsWith('./') || raw.startsWith('../') || raw.startsWith('?') || raw.startsWith('#')) {
    return raw;
  }

  try {
    const url = new URL(raw);
    return ALLOWED_LINK_PROTOCOLS.has(url.protocol) ? url.toString() : '';
  } catch (error) {
    return '';
  }
}

/**
 * @param {string|null|undefined} value
 * @returns {string}
 */
function resolveSafeImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch (error) {
    return '';
  }
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(value || '').trim());
}

/**
 * @param {number|null|undefined} amount
 * @param {string|null|undefined} currency
 * @returns {string}
 */
function formatMoney(amount, currency) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '';
  const code = currency || 'USD';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    return `${amount.toFixed(2)} ${code}`;
  }
}

/**
 * @param {string} text
 * @returns {string}
 */
function getInitial(text) {
  const match = String(text || '').trim().match(/[a-z0-9]/i);
  return match ? match[0].toUpperCase() : '•';
}

/**
 * @param {HTMLElement} block
 * @returns {object}
 */
function getConfig(block) {
  const config = readBlockConfig(block);
  const sku = String(config.sku || '').trim();

  return {
    sku,
    title: String(config.title || DEFAULTS.title).trim(),
    eyebrow: String(config.eyebrow || DEFAULTS.eyebrow).trim(),
    description: String(config.description || DEFAULTS.description).trim(),
    theme: normalizeEnum(config.theme, THEMES, DEFAULTS.theme),
    layout: normalizeEnum(config.layout, LAYOUTS, DEFAULTS.layout),
    showSummary: parseBoolean(config['show-summary'], DEFAULTS.showSummary),
    showPrice: parseBoolean(config['show-price'], DEFAULTS.showPrice),
    showGallery: parseBoolean(config['show-gallery'], DEFAULTS.showGallery),
    showSpecHighlights: parseBoolean(
      config['show-spec-highlights'],
      DEFAULTS.showSpecHighlights,
    ),
    ctaLabel: String(config['cta-label'] || DEFAULTS.ctaLabel).trim(),
    pdpLinkLabel: String(config['pdp-link-label'] || DEFAULTS.pdpLinkLabel).trim(),
    conciergeLabel: String(config['concierge-label'] || DEFAULTS.conciergeLabel).trim(),
    conciergeHref: resolveSafeHref(config['concierge-href'] || DEFAULTS.conciergeHref),
    attributeGroups: parseAttributeGroups(config['attribute-groups'] || DEFAULTS.attributeGroups),
  };
}

/**
 * @param {string} raw
 * @returns {Array<{label:string, keys:Set<string>}>}
 */
function parseAttributeGroups(raw) {
  return String(raw || '')
    .split(/\s*;\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [labelPart, valuesPart] = entry.split(':');
      const label = String(labelPart || '').trim();
      const keys = new Set(
        String(valuesPart || '')
          .split(/\s*,\s*/)
          .map((value) => normalizeToken(value))
          .filter(Boolean),
      );
      return label && keys.size ? { label, keys } : null;
    })
    .filter(Boolean);
}

/**
 * @param {string} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

/**
 * @param {string} href
 * @param {string} className
 * @param {string} label
 * @returns {HTMLAnchorElement}
 */
function createLinkButton(href, className, label) {
  const link = document.createElement('a');
  link.className = className;
  link.href = href;
  link.textContent = label;

  if (/^https?:/i.test(href) && !href.startsWith(window.location.origin)) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }

  return link;
}

/**
 * @param {Array<object>} options
 * @returns {Array<object>}
 */
function getSelectedOptions(options = []) {
  return options
    .map((option) => ({
      ...option,
      selectedItem: option.items?.find((item) => item.selected) || null,
    }))
    .filter((option) => option.selectedItem);
}

/**
 * @param {Array<object>} options
 * @returns {number}
 */
function getRequiredSelectionCount(options = []) {
  return options.filter((option) => option.required && !option.multiple).length;
}

/**
 * @param {Array<object>} options
 * @returns {number}
 */
function getSatisfiedSelectionCount(options = []) {
  return options.filter((option) => option.items?.some((item) => item.selected)).length;
}

/**
 * @param {Array<object>} options
 * @param {Array<{label:string, keys:Set<string>}>} authoredGroups
 * @returns {Array<{label:string, options:Array<object>}>}
 */
function groupOptions(options = [], authoredGroups = []) {
  const groups = authoredGroups.map((group) => ({
    label: group.label,
    options: [],
    keys: group.keys,
  }));

  const fallbackGroup = {
    label: 'Configuration',
    options: [],
  };

  options.forEach((option) => {
    const optionKey = normalizeToken(option.label);
    const targetGroup = groups.find((group) => group.keys.has(optionKey));
    if (targetGroup) {
      targetGroup.options.push(option);
    } else {
      fallbackGroup.options.push(option);
    }
  });

  return [
    ...groups
      .filter((group) => group.options.length)
      .map(({ label, options: groupedOptions }) => ({ label, options: groupedOptions })),
    ...(fallbackGroup.options.length ? [fallbackGroup] : []),
  ];
}

/**
 * @param {HTMLElement} block
 * @returns {object}
 */
function buildShell(block) {
  const shell = createElement('section', 'luxury-configurator__shell');
  shell.setAttribute('aria-live', 'polite');

  const hero = createElement('div', 'luxury-configurator__hero');
  const eyebrow = createElement('p', 'luxury-configurator__eyebrow');
  const title = createElement('h2', 'luxury-configurator__title');
  const body = createElement('p', 'luxury-configurator__description');
  const completion = createElement('div', 'luxury-configurator__completion');
  hero.append(eyebrow, title, body, completion);

  const stage = createElement('div', 'luxury-configurator__stage');
  const statusRow = createElement('div', 'luxury-configurator__status-row');
  const stockPill = createElement('span', 'luxury-configurator__pill');
  const statusText = createElement('p', 'luxury-configurator__status');
  statusRow.append(stockPill, statusText);

  const mediaFrame = createElement('div', 'luxury-configurator__media-frame');
  const mediaImage = document.createElement('img');
  mediaImage.className = 'luxury-configurator__media-image';
  mediaImage.loading = 'lazy';
  mediaImage.decoding = 'async';
  mediaFrame.append(mediaImage);

  const meta = createElement('div', 'luxury-configurator__meta');
  const metaName = createElement('h3', 'luxury-configurator__product-name');
  const metaSku = createElement('p', 'luxury-configurator__product-sku');
  const price = createElement('div', 'luxury-configurator__price');
  meta.append(metaName, metaSku, price);

  const summary = createElement('div', 'luxury-configurator__panel luxury-configurator__panel-summary');
  const summaryHeading = createElement('h3', 'luxury-configurator__panel-heading', 'Selection summary');
  const summaryList = createElement('ul', 'luxury-configurator__summary-list');
  summary.append(summaryHeading, summaryList);

  const highlights = createElement('div', 'luxury-configurator__panel luxury-configurator__panel-highlights');
  const highlightsHeading = createElement('h3', 'luxury-configurator__panel-heading', 'Technical highlights');
  const highlightsList = createElement('ul', 'luxury-configurator__highlights-list');
  highlights.append(highlightsHeading, highlightsList);

  stage.append(statusRow, mediaFrame, meta, summary, highlights);

  const controls = createElement('div', 'luxury-configurator__controls');
  const optionsHeader = createElement('div', 'luxury-configurator__controls-header');
  const optionsTitle = createElement('h3', 'luxury-configurator__controls-title', 'Curate your configuration');
  const optionsIntro = createElement(
    'p',
    'luxury-configurator__controls-copy',
    'Each change refines the live Commerce product, including variant, imagery, price, and availability.',
  );
  optionsHeader.append(optionsTitle, optionsIntro);

  const optionGroups = createElement('div', 'luxury-configurator__option-groups');

  const actionRail = createElement('div', 'luxury-configurator__action-rail');
  const quantityLabel = createElement('label', 'luxury-configurator__quantity-label', 'Quantity');
  quantityLabel.setAttribute('for', `luxury-configurator-qty-${Math.random().toString(36).slice(2, 8)}`);
  const quantityControls = createElement('div', 'luxury-configurator__quantity-controls');
  const quantityDecrease = createElement('button', 'luxury-configurator__quantity-button', '−');
  quantityDecrease.type = 'button';
  quantityDecrease.dataset.action = 'decrease-quantity';
  const quantityInput = document.createElement('input');
  quantityInput.className = 'luxury-configurator__quantity-input';
  quantityInput.type = 'number';
  quantityInput.min = '1';
  quantityInput.max = '99';
  quantityInput.step = '1';
  quantityInput.id = quantityLabel.getAttribute('for');
  const quantityIncrease = createElement('button', 'luxury-configurator__quantity-button', '+');
  quantityIncrease.type = 'button';
  quantityIncrease.dataset.action = 'increase-quantity';
  quantityControls.append(quantityDecrease, quantityInput, quantityIncrease);
  quantityLabel.append(quantityControls);

  const primaryAction = createElement('button', 'luxury-configurator__primary-action');
  primaryAction.type = 'button';

  const secondaryActions = createElement('div', 'luxury-configurator__secondary-actions');
  const message = createElement('p', 'luxury-configurator__message');
  const engine = createElement('div', 'luxury-configurator__engine');
  engine.hidden = true;

  actionRail.append(quantityLabel, primaryAction, secondaryActions, message, engine);
  controls.append(optionsHeader, optionGroups, actionRail);

  shell.append(hero, stage, controls);
  block.replaceChildren(shell);

  return {
    shell,
    hero,
    eyebrow,
    title,
    body,
    completion,
    stage,
    stockPill,
    statusText,
    mediaFrame,
    mediaImage,
    metaName,
    metaSku,
    price,
    summary,
    summaryList,
    highlights,
    highlightsList,
    optionGroups,
    quantityInput,
    primaryAction,
    secondaryActions,
    message,
    engine,
  };
}

/**
 * @param {HTMLElement} list
 * @param {Array<object>} selectedOptions
 */
function renderSummaryList(list, selectedOptions) {
  list.replaceChildren();

  if (!selectedOptions.length) {
    const item = createElement('li', 'luxury-configurator__summary-empty', 'No attributes selected yet.');
    list.append(item);
    return;
  }

  selectedOptions.forEach((option) => {
    const item = createElement('li', 'luxury-configurator__summary-item');
    const label = createElement('span', 'luxury-configurator__summary-label', option.label);
    const value = createElement(
      'strong',
      'luxury-configurator__summary-value',
      option.selectedItem?.label || 'Pending',
    );
    item.append(label, value);
    list.append(item);
  });
}

/**
 * @param {HTMLElement} list
 * @param {Array<object>} attributes
 */
function renderHighlightsList(list, attributes = []) {
  list.replaceChildren();

  if (!attributes.length) {
    list.append(createElement('li', 'luxury-configurator__highlights-empty', 'No technical highlights available.'));
    return;
  }

  attributes.slice(0, 4).forEach((attribute) => {
    const item = createElement('li', 'luxury-configurator__highlight-item');
    item.append(
      createElement('span', 'luxury-configurator__highlight-label', attribute.label),
      createElement('strong', 'luxury-configurator__highlight-value', attribute.value),
    );
    list.append(item);
  });
}

/**
 * @param {HTMLElement} container
 * @param {object} option
 * @param {Function} onSelect
 */
function renderSwatchGroup(container, option, onSelect) {
  const list = createElement('div', 'luxury-configurator__swatch-list');
  list.setAttribute('role', 'list');

  option.items.forEach((item) => {
    const button = createElement('button', 'luxury-configurator__swatch');
    button.type = 'button';
    button.dataset.optionId = option.id;
    button.dataset.valueId = item.id;
    button.dataset.optionType = option.type;
    button.disabled = !item.inStock;
    button.setAttribute('aria-pressed', item.selected ? 'true' : 'false');
    button.addEventListener('click', () => onSelect(option, item.id));

    if (option.type === 'color' && isHexColor(item.value)) {
      const tone = createElement('span', 'luxury-configurator__swatch-tone');
      tone.style.backgroundColor = item.value;
      tone.setAttribute('aria-hidden', 'true');
      button.append(tone);
    } else if (option.type === 'image') {
      const imageUrl = resolveSafeImageUrl(item.value);
      if (imageUrl) {
        const image = document.createElement('img');
        image.className = 'luxury-configurator__swatch-image';
        image.src = imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        button.append(image);
      } else {
        button.append(createElement('span', 'luxury-configurator__swatch-fallback', getInitial(item.label)));
      }
    } else {
      button.append(createElement('span', 'luxury-configurator__swatch-fallback', getInitial(item.label)));
    }

    const textWrap = createElement('span', 'luxury-configurator__swatch-copy');
    textWrap.append(
      createElement('span', 'luxury-configurator__swatch-label', item.label),
      createElement(
        'span',
        'luxury-configurator__swatch-meta',
        item.inStock ? 'In stock' : 'Unavailable',
      ),
    );
    button.append(textWrap);
    list.append(button);
  });

  container.append(list);
}

/**
 * @param {HTMLElement} container
 * @param {object} option
 * @param {Function} onSelect
 */
function renderSelectGroup(container, option, onSelect) {
  const select = document.createElement('select');
  select.className = 'luxury-configurator__select';
  select.dataset.optionId = option.id;

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = `Choose ${option.label}`;
  placeholder.selected = !option.items.some((item) => item.selected);
  placeholder.disabled = option.required;
  select.append(placeholder);

  option.items.forEach((item) => {
    const entry = document.createElement('option');
    entry.value = item.id;
    entry.textContent = item.inStock ? item.label : `${item.label} (Unavailable)`;
    entry.selected = item.selected;
    entry.disabled = !item.inStock;
    select.append(entry);
  });

  select.addEventListener('change', (event) => {
    const { value } = event.target;
    if (value) {
      onSelect(option, value);
    }
  });

  container.append(select);
}

/**
 * @param {HTMLElement} container
 * @param {Array<{label:string, options:Array<object>}>} groups
 * @param {Function} onSelect
 */
function renderOptionGroups(container, groups, onSelect) {
  container.replaceChildren();

  groups.forEach((group) => {
    const groupPanel = createElement('section', 'luxury-configurator__option-group');
    groupPanel.append(createElement('h4', 'luxury-configurator__option-group-heading', group.label));

    group.options.forEach((option) => {
      const optionCard = createElement('div', 'luxury-configurator__option-card');
      const optionHeader = createElement('div', 'luxury-configurator__option-header');
      const optionLabel = createElement('h5', 'luxury-configurator__option-label', option.label);
      const optionMeta = createElement(
        'span',
        'luxury-configurator__option-meta',
        option.required ? 'Required' : 'Optional',
      );
      optionHeader.append(optionLabel, optionMeta);
      optionCard.append(optionHeader);

      if (option.multiple) {
        optionCard.append(
          createElement(
            'p',
            'luxury-configurator__option-note',
            'This experience currently supports single-select Commerce attributes only.',
          ),
        );
      } else if (option.type === 'dropdown') {
        renderSelectGroup(optionCard, option, onSelect);
      } else {
        renderSwatchGroup(optionCard, option, onSelect);
      }

      groupPanel.append(optionCard);
    });

    container.append(groupPanel);
  });
}

/**
 * @param {HTMLElement} target
 * @param {string} message
 * @param {string} tone
 */
function setMessage(target, message, tone = 'neutral') {
  target.textContent = message;
  target.dataset.tone = tone;
}

/**
 * @param {object} refs
 * @param {object} config
 * @param {object} state
 */
function renderState(refs, config, state) {
  const { product } = state;
  const selectedOptions = getSelectedOptions(product?.options);
  const selectedCount = getSatisfiedSelectionCount(product?.options);
  const requiredCount = getRequiredSelectionCount(product?.options);
  const variantSku = product?.variantSku || product?.sku || config.sku;
  const imageUrl = resolveSafeImageUrl(product?.images?.[0]?.url);
  const imageAlt = product?.images?.[0]?.label || product?.name || config.title;
  const summaryVisible = config.showSummary;
  const highlightsVisible = config.showSpecHighlights;

  refs.shell.dataset.theme = config.theme;
  refs.shell.dataset.layout = config.layout;
  refs.shell.classList.toggle('is-loading', state.loading);
  refs.shell.classList.toggle('has-gallery', Boolean(config.showGallery && imageUrl));
  refs.shell.setAttribute('aria-busy', state.loading ? 'true' : 'false');

  refs.eyebrow.textContent = config.eyebrow;
  refs.title.textContent = config.title;
  refs.body.textContent = config.description
    || toPlainText(product?.shortDescription)
    || DEFAULTS.description;
  refs.completion.textContent = requiredCount
    ? `${selectedCount} of ${requiredCount} required attributes selected`
    : 'Live variant data is ready to refine.';

  refs.metaName.textContent = product?.name || 'Configured product';
  refs.metaSku.textContent = variantSku ? `Variant SKU: ${variantSku}` : 'Variant SKU will update as you configure.';

  if (config.showPrice) {
    refs.price.replaceChildren();
    const finalAmount = product?.prices?.final?.amount;
    const finalCurrency = product?.prices?.final?.currency;
    const regularAmount = product?.prices?.regular?.amount;
    const finalText = formatMoney(finalAmount, finalCurrency);
    const regularText = formatMoney(regularAmount, finalCurrency);

    if (finalText) {
      refs.price.append(createElement('strong', 'luxury-configurator__price-final', finalText));
      if (regularText && regularText !== finalText) {
        refs.price.append(createElement('span', 'luxury-configurator__price-regular', regularText));
      }
    } else {
      refs.price.append(createElement('span', 'luxury-configurator__price-empty', 'Price available after configuration.'));
    }
  } else {
    refs.price.replaceChildren();
  }

  if (config.showGallery && imageUrl) {
    refs.mediaFrame.hidden = false;
    refs.mediaImage.src = imageUrl;
    refs.mediaImage.alt = imageAlt;
  } else {
    refs.mediaFrame.hidden = true;
    refs.mediaImage.removeAttribute('src');
    refs.mediaImage.alt = '';
  }

  refs.summary.hidden = !summaryVisible;
  if (summaryVisible) {
    renderSummaryList(refs.summaryList, selectedOptions);
  }

  refs.highlights.hidden = !highlightsVisible;
  if (highlightsVisible) {
    renderHighlightsList(refs.highlightsList, product?.attributes);
  }

  let stockPillText = 'Select';
  let stockPillTone = 'neutral';
  if (state.loading) {
    stockPillText = 'Refining';
    stockPillTone = 'loading';
  } else if (product?.inStock === false) {
    stockPillText = 'Unavailable';
    stockPillTone = 'warning';
  } else if (state.valid) {
    stockPillText = 'Ready';
    stockPillTone = 'success';
  }
  refs.stockPill.textContent = stockPillText;
  refs.stockPill.dataset.tone = stockPillTone;

  if (state.loading) {
    refs.statusText.textContent = 'Refreshing the live product configuration...';
  } else if (product?.inStock === false) {
    refs.statusText.textContent = 'The current combination is unavailable. Select another attribute value.';
  } else if (state.valid) {
    refs.statusText.textContent = 'Configuration complete. Pricing and SKU are aligned to the current variant.';
  } else {
    refs.statusText.textContent = 'Select all required attributes to unlock the final configuration.';
  }

  renderOptionGroups(
    refs.optionGroups,
    groupOptions(product?.options, config.attributeGroups),
    state.onSelect,
  );

  refs.quantityInput.value = String(state.quantity);
  refs.primaryAction.textContent = state.addingToCart
    ? 'Adding to cart...'
    : config.ctaLabel;
  refs.primaryAction.disabled = state.addingToCart || !state.valid || product?.inStock === false;

  refs.secondaryActions.replaceChildren();
  const productHref = product?.urlKey ? getProductLink(product.urlKey, config.sku) : '';
  if (productHref) {
    refs.secondaryActions.append(
      createLinkButton(productHref, 'luxury-configurator__secondary-action', config.pdpLinkLabel),
    );
  }
  if (config.conciergeHref) {
    refs.secondaryActions.append(
      createLinkButton(
        config.conciergeHref,
        'luxury-configurator__secondary-action luxury-configurator__secondary-action--ghost',
        config.conciergeLabel,
      ),
    );
  }
}

/**
 * @param {number|string|null|undefined} value
 * @returns {number}
 */
function clampQuantity(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return 1;
  if (parsed > 99) return 99;
  return parsed;
}

/**
 * @param {string} optionId
 * @param {string} valueId
 * @param {Array<object>} [options]
 * @returns {string[]}
 */
function buildSelectedOptionIds(optionId, valueId, options) {
  const normalizedOptions = Array.isArray(options) ? options : [];

  return normalizedOptions
    .map((option) => {
      if (option.id === optionId) {
        return valueId;
      }
      return option.items?.find((item) => item.selected)?.id || null;
    })
    .filter(Boolean);
}

/**
 * @param {HTMLElement} block
 * @param {string} title
 * @param {string} message
 */
function renderFailure(block, title, message) {
  const shell = createElement('section', 'luxury-configurator__shell luxury-configurator__shell--error');
  shell.append(
    createElement('p', 'luxury-configurator__eyebrow', 'Luxury Configurator'),
    createElement('h2', 'luxury-configurator__title', title),
    createElement('p', 'luxury-configurator__description', message),
  );
  block.replaceChildren(shell);
}

/**
 * @param {HTMLElement} block
 * @param {object} config
 */
async function initializeConfigurator(block, config) {
  const refs = buildShell(block);
  const scope = `luxury-configurator-${Math.random().toString(36).slice(2, 10)}`;
  const labels = await fetchPlaceholders('placeholders/pdp.json');

  setEndpoint(CS_FETCH_GRAPHQL);

  const optionsUIDs = getOptionsUIDsFromUrl();
  const [initialProduct, initialModel] = await Promise.all([
    fetchProductData(config.sku, {
      optionsUIDs,
      skipTransform: true,
    }),
    fetchProductData(config.sku, { optionsUIDs }),
  ]);

  if (!initialProduct?.sku || !initialModel?.sku) {
    renderFailure(
      block,
      'Product unavailable',
      'The configured SKU could not be loaded from Adobe Commerce. Verify the parent SKU and try again.',
    );
    return;
  }

  await initializers.mountImmediately(initialize, {
    scope,
    sku: config.sku,
    optionsUIDs,
    langDefinitions: {
      default: {
        ...labels,
      },
    },
    models: {
      ProductDetails: {
        initialData: { ...initialProduct },
        fallbackData: (parent, refinedData) => ({
          ...parent,
          ...refinedData,
          images: refinedData.images?.length ? refinedData.images : parent.images,
          description:
            refinedData.description && refinedData.description !== ''
              ? refinedData.description
              : parent.description,
          shortDescription:
            refinedData.shortDescription && refinedData.shortDescription !== ''
              ? refinedData.shortDescription
              : parent.shortDescription,
        }),
      },
    },
    acdl: false,
    persistURLParams: true,
  });

  await pdpRender.render(ProductOptions, {
    scope,
    hideSelectedValue: false,
  })(refs.engine);

  setProductConfigurationValues((previous) => ({
    ...previous,
    quantity: clampQuantity(previous?.quantity || 1),
  }), { scope });

  const state = {
    product: initialModel,
    loading: false,
    valid: isProductConfigurationValid({ scope }),
    quantity: clampQuantity(getProductConfigurationValues({ scope })?.quantity || 1),
    addingToCart: false,
    onSelect: (option, valueId) => {
      state.loading = true;
      const nextOptionIds = buildSelectedOptionIds(
        option.id,
        valueId,
        state.product?.options,
      );
      setProductConfigurationValues((previous) => ({
        ...previous,
        quantity: clampQuantity(previous?.quantity || state.quantity),
        optionsUIDs: nextOptionIds,
      }), { scope });
      renderState(refs, config, state);
    },
  };

  const updateQuantity = (nextQuantity) => {
    state.quantity = clampQuantity(nextQuantity);
    setProductConfigurationValues((previous) => ({
      ...previous,
      quantity: state.quantity,
    }), { scope });
    renderState(refs, config, state);
  };

  refs.quantityInput.addEventListener('change', (event) => {
    updateQuantity(event.target.value);
  });

  refs.quantityInput.addEventListener('blur', (event) => {
    updateQuantity(event.target.value);
  });

  refs.shell.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    if (target.dataset.action === 'decrease-quantity') {
      updateQuantity(state.quantity - 1);
    }

    if (target.dataset.action === 'increase-quantity') {
      updateQuantity(state.quantity + 1);
    }
  });

  refs.primaryAction.addEventListener('click', async () => {
    if (state.addingToCart) return;

    const valid = isProductConfigurationValid({ scope });
    if (!valid) {
      state.valid = false;
      setMessage(
        refs.message,
        'Select all required attributes before adding the configured product to cart.',
        'warning',
      );
      renderState(refs, config, state);
      return;
    }

    try {
      state.addingToCart = true;
      setMessage(refs.message, '', 'neutral');
      renderState(refs, config, state);

      const { addProductsToCart } = await import('@dropins/storefront-cart/api.js');
      const values = getProductConfigurationValues({ scope });
      await addProductsToCart([{ ...values }]);

      setMessage(refs.message, 'Configured product added to cart.', 'success');
    } catch (error) {
      setMessage(
        refs.message,
        error instanceof Error ? error.message : 'Unable to add the configured product to cart.',
        'warning',
      );
    } finally {
      state.addingToCart = false;
      renderState(refs, config, state);
    }
  });

  events.on('pdp/data', (payload) => {
    state.product = payload;
    state.loading = false;
    renderState(refs, config, state);
  }, { scope });

  events.on('pdp/values', (values) => {
    state.quantity = clampQuantity(values?.quantity || state.quantity);
  }, { scope, eager: true });

  events.on('pdp/valid', (valid) => {
    state.valid = Boolean(valid);
    renderState(refs, config, state);
  }, { scope, eager: true });

  renderState(refs, config, state);
}

/**
 * @param {HTMLElement} block
 */
export default async function decorate(block) {
  const config = getConfig(block);

  if (!config.sku) {
    renderFailure(
      block,
      'Configurator unavailable',
      'Add a parent configurable product SKU to the block authoring so the live configuration engine can load.',
    );
    return;
  }

  block.classList.add('luxury-configurator');

  try {
    await initializeConfigurator(block, config);
  } catch (error) {
    console.error('luxury-configurator: failed to load live product configuration', error);
    renderFailure(
      block,
      'Configurator unavailable',
      'The live configuration studio could not be loaded. Refresh the page or try again shortly.',
    );
  }
}
