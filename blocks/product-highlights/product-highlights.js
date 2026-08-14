const DEFAULT_CTA_LABEL = 'Browse full catalog';
const DEFAULT_CTA_URL = '#';
const DEFAULT_BG_START = 'var(--color-ink-50, #f0f7f3)';
const DEFAULT_BG_END = 'var(--color-green-50, #e4f9ef)';
const CARD_VISIBLE_THRESHOLD = 0.08;
const SPACE_KEY = ' ';

function getValueCell(row, index = 1) {
  if (!row) return null;
  const cells = row.querySelectorAll(':scope > div');
  return cells[index] || cells[0] || null;
}

function getCellText(row, index = 1) {
  return getValueCell(row, index)?.innerText?.trim() || '';
}

function getCellHTML(row, index = 1) {
  return getValueCell(row, index)?.innerHTML?.trim() || '';
}

function parsePipe(value) {
  return (value || '').split('|').map((entry) => entry.trim());
}

function toSafeUrl(rawUrl) {
  if (!rawUrl) return '';

  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('//')) return '';

  const relativePrefixes = ['/', './', '../', '#', '?'];
  if (relativePrefixes.some((prefix) => trimmed.startsWith(prefix))) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    const allowed = ['http:', 'https:', 'mailto:', 'tel:'];
    if (allowed.includes(parsed.protocol)) return trimmed;
  } catch (error) {
    return '';
  }

  return '';
}

function badgeClass(label) {
  const key = (label || '').trim().toLowerCase();
  if (key === 'new') return 'badge-new';
  if (key === 'popular') return 'badge-hot';
  if (key.startsWith('save')) return 'badge-sale';
  return 'badge-new';
}

function createElement(tag, options = {}) {
  const {
    className = '',
    attrs = {},
    text = '',
    children = [],
  } = options;

  const node = document.createElement(tag);
  if (className) node.className = className;

  Object.entries(attrs).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      node.setAttribute(name, value);
    }
  });

  if (text) node.append(text);
  children.forEach((child) => child && node.append(child));
  return node;
}

function createArrowIcon() {
  return `<svg width="13" height="13" fill="none" stroke="currentColor"
    stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
}

function createAddButton() {
  const button = createElement('button', {
    className: 'product-card__add',
    attrs: {
      type: 'button',
      'aria-label': 'Add to cart',
    },
    text: '+',
  });

  let resetTimer = 0;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    button.textContent = '\u2713';
    button.classList.add('added');

    if (resetTimer) window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      button.textContent = '+';
      button.classList.remove('added');
      resetTimer = 0;
    }, 1500);
  });

  return button;
}

function createPrice(price) {
  const priceNode = createElement('div', { className: 'product-card__price' });
  priceNode.append(createElement('sup', { text: '$' }), price || '');
  return priceNode;
}

function goTo(url) {
  window.location.href = url;
}

function buildCard(product) {
  const imageArea = createElement('div', { className: 'product-card__img' });
  const bgStart = product.bgStart || DEFAULT_BG_START;
  const bgEnd = product.bgEnd || DEFAULT_BG_END;
  imageArea.style.background = `linear-gradient(135deg, ${bgStart}, ${bgEnd})`;
  imageArea.append(createElement('span', {
    attrs: { 'aria-hidden': 'true' },
    text: product.emoji || '',
  }));

  if (product.badgeLabel) {
    imageArea.append(createElement('span', {
      className: `product-card__badge ${badgeClass(product.badgeLabel)}`,
      text: product.badgeLabel,
    }));
  }

  const footer = createElement('div', {
    className: 'product-card__footer',
    children: [createPrice(product.price), createAddButton()],
  });

  const body = createElement('div', {
    className: 'product-card__body',
    children: [
      createElement('div', {
        className: 'product-card__name',
        text: product.name || 'Product',
      }),
      createElement('div', {
        className: 'product-card__sku',
        text: product.sku || '',
      }),
      footer,
    ],
  });

  const safeUrl = toSafeUrl(product.url || '');
  const card = createElement('div', {
    className: 'product-card',
    attrs: { role: safeUrl ? 'link' : 'article' },
    children: [imageArea, body],
  });

  if (safeUrl) {
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => goTo(safeUrl));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === SPACE_KEY) {
        event.preventDefault();
        goTo(safeUrl);
      }
    });
  }

  return card;
}

function readCta(rows) {
  const ctaCell = getValueCell(rows[2], 1) || rows[2];
  const ctaAnchor = ctaCell?.querySelector('a[href]');

  if (!ctaAnchor) {
    return { label: DEFAULT_CTA_LABEL, url: DEFAULT_CTA_URL };
  }

  const label = ctaAnchor.textContent?.trim() || DEFAULT_CTA_LABEL;
  const authoredHref = ctaAnchor.getAttribute('href') || ctaAnchor.href || '';
  const url = toSafeUrl(authoredHref) || DEFAULT_CTA_URL;

  return { label, url };
}

function revealOnScroll(cards) {
  if (!cards.length) return;

  if (!('IntersectionObserver' in window)) {
    cards.forEach((card) => card.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: CARD_VISIBLE_THRESHOLD });

  cards.forEach((card) => observer.observe(card));
}

export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  const sectionTag = getCellText(rows[0], 1);
  const titleHtml = getCellHTML(rows[1], 1);
  const cta = readCta(rows);

  const cards = rows.slice(3).map((row) => {
    const [emoji, badgeLabel, name, sku, price, url, bgRaw] = parsePipe(getCellText(row, 1));
    const [bgStart, bgEnd] = (bgRaw || '').split(',').map((part) => part.trim());

    return buildCard({
      emoji,
      badgeLabel,
      name,
      sku,
      price,
      url,
      bgStart,
      bgEnd,
    });
  });

  const title = createElement('h2', { className: 'section-title' });
  title.innerHTML = titleHtml;

  const ctaLink = createElement('a', {
    className: 'ph-cta',
    attrs: { href: cta.url },
  });
  ctaLink.append(cta.label, ' ');
  ctaLink.insertAdjacentHTML('beforeend', createArrowIcon());

  const header = createElement('div', {
    className: 'products-header',
    children: [
      createElement('div', {
        className: 'ph-header-left',
        children: [
          createElement('div', { className: 'section-tag', text: sectionTag }),
          title,
        ],
      }),
      ctaLink,
    ],
  });

  const grid = createElement('div', { className: 'products-grid' });
  cards.forEach((card) => grid.append(card));

  block.textContent = '';
  block.append(header, grid);

  revealOnScroll(cards);
}
