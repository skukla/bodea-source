/**
 * How-it-works-stats block for EDS document authoring.
 *
 * Table contract (1 column, 12 rows after block name):
 * 0 tag
 * 1 title (supports rich text)
 * 2 step 1: icon | title | description
 * 3 step 2: icon | title | description
 * 4 step 3: icon | title | description
 * 5 step 4: icon | title | description
 * 6 stat 1: value | label
 * 7 stat 2: value | label
 * 8 stat 3: value | label
 * 9 stat 4: value | label
 * 10 primary CTA link
 * 11 secondary CTA link
 */

/**
 * Read a block row container cell.
 * @param {HTMLElement} block
 * @param {number} rowIndex
 * @returns {HTMLElement | null}
 */
function rowCell(block, rowIndex) {
  const row = block.children[rowIndex];
  if (!row) return null;
  return row.querySelector('div') || row;
}

/**
 * Read row text.
 * @param {HTMLElement} block
 * @param {number} rowIndex
 * @returns {string}
 */
function rowText(block, rowIndex) {
  const cell = rowCell(block, rowIndex);
  return cell?.innerText.trim() || '';
}

/**
 * Read authored row and split pipe-delimited values.
 * @param {HTMLElement} block
 * @param {number} rowIndex
 * @returns {string[]}
 */
function rowParts(block, rowIndex) {
  return rowText(block, rowIndex).split('|').map((part) => part.trim());
}

/**
 * Parse step row values, supporting both:
 * - icon | title | description
 * - 01 | icon | title | description
 * @param {string[]} parts
 * @returns {{icon: string, title: string, description: string}}
 */
function parseStep(parts) {
  if (!parts.length) return { icon: '', title: '', description: '' };

  const hasLeadingNumber = /^\d{1,2}$/.test(parts[0]);
  const start = hasLeadingNumber ? 1 : 0;
  const icon = parts[start] || '';
  const title = parts[start + 1] || '';
  const description = parts.slice(start + 2).join(' | ');

  return { icon, title, description };
}

/**
 * Parse stat row values as value | label (supports extra pipes in label).
 * @param {string[]} parts
 * @returns {{value: string, label: string}}
 */
function parseStat(parts) {
  if (!parts.length) return { value: '', label: '' };
  return {
    value: parts[0] || '',
    label: parts.slice(1).join(' | '),
  };
}

/**
 * Validate URL protocols for CTA links.
 * @param {string} url
 * @returns {string}
 */
function sanitizeUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('//')) return '';
  if (['#', '/', './', '../', '?'].some((token) => trimmed.startsWith(token))) return trimmed;

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) return trimmed;
    return '';
  } catch {
    return '';
  }
}

/**
 * Read CTA link from authored row.
 * Supports a real link in rich text, or fallback `label | href`.
 * @param {HTMLElement} block
 * @param {number} rowIndex
 * @returns {{href: string, text: string, target: string, rel: string} | null}
 */
function rowLink(block, rowIndex) {
  const cell = rowCell(block, rowIndex);
  if (!cell) return null;

  const anchor = cell.querySelector('a[href]');
  if (anchor) {
    const href = sanitizeUrl(anchor.getAttribute('href') || '');
    if (!href) return null;
    return {
      href,
      text: anchor.textContent.trim() || 'Learn More',
      target: anchor.getAttribute('target') || '',
      rel: anchor.getAttribute('rel') || '',
    };
  }

  const parts = rowText(block, rowIndex).split('|').map((part) => part.trim());
  if (parts.length >= 2) {
    const href = sanitizeUrl(parts[1]);
    if (!href) return null;
    return {
      href,
      text: parts[0] || 'Learn More',
      target: '',
      rel: '',
    };
  }

  return null;
}

/**
 * Tiny element factory.
 * @param {string} tag
 * @param {string} className
 * @param {Record<string, string>} attrs
 * @param {Array<HTMLElement | Text>} children
 * @returns {HTMLElement}
 */
function el(tag, className = '', attrs = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  children.forEach((child) => {
    if (child) node.append(child);
  });
  return node;
}

/**
 * Parse a value into primary value and suffix.
 * @param {string} value
 * @returns {{main: string, suffix: string}}
 */
function splitValue(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return { main: '', suffix: '' };
  const match = trimmed.match(/^([0-9.,$]+)(.*)$/);
  if (!match) return { main: trimmed, suffix: '' };
  return {
    main: match[1].trim(),
    suffix: match[2].trim(),
  };
}

/**
 * Convert authored break text into real line breaks for title rich text.
 * @param {string} html
 * @returns {string}
 */
function normalizeBreakMarkup(html) {
  return (html || '')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/<br\s*\/?>/gi, '<br>');
}

/**
 * Create one process step.
 * @param {number} index
 * @param {string} icon
 * @param {string} title
 * @param {string} description
 * @returns {HTMLElement}
 */
function buildStep(index, icon, title, description) {
  const number = String(index + 1).padStart(2, '0');
  const step = el('div', 'hiws-step hiws-reveal');
  step.append(
    el('div', 'hiws-step-num', {}, [document.createTextNode(number)]),
    el('div', 'hiws-step-icon', {}, [document.createTextNode(icon || '•')]),
    el('h3', 'hiws-step-title', {}, [document.createTextNode(title || '')]),
    el('p', 'hiws-step-desc', {}, [document.createTextNode(description || '')]),
    el('div', 'hiws-step-connector', { 'aria-hidden': 'true' }, [document.createTextNode('→')]),
  );
  return step;
}

/**
 * Create one stats item.
 * @param {string} value
 * @param {string} label
 * @returns {HTMLElement}
 */
function buildStat(value, label) {
  const parts = splitValue(value);
  const valueEl = el('div', 'hiws-stat-value');
  valueEl.append(
    document.createTextNode(parts.main),
    parts.suffix ? el('span', '', {}, [document.createTextNode(parts.suffix)]) : null,
  );

  return el('div', 'hiws-stat-item hiws-reveal', {}, [
    valueEl,
    el('div', 'hiws-stat-label', {}, [document.createTextNode(label || '')]),
  ]);
}

/**
 * Build CTA action button.
 * @param {{href: string, text: string, target: string, rel: string}} link
 * @param {'primary' | 'secondary'} variant
 * @returns {HTMLAnchorElement}
 */
function buildAction(link, variant) {
  const anchor = document.createElement('a');
  anchor.className = `hiws-btn hiws-btn-${variant}`;
  anchor.href = link.href;
  anchor.textContent = link.text;
  if (link.target) anchor.target = link.target;
  if (link.rel) {
    anchor.rel = link.rel;
  } else if (link.target === '_blank') {
    anchor.rel = 'noopener noreferrer';
  }

  const arrow = el('span', 'hiws-btn-arrow', { 'aria-hidden': 'true' }, [
    document.createTextNode('→'),
  ]);
  anchor.append(arrow);
  return anchor;
}

/**
 * Reveal elements on scroll for staged motion.
 * @param {HTMLElement} root
 */
function setupReveal(root) {
  const targets = [...root.querySelectorAll('.hiws-reveal')];
  if (!targets.length) return;

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
    targets.forEach((target) => target.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });

  targets.forEach((target, index) => {
    target.style.setProperty('--hiws-delay', `${Math.min(index * 70, 700)}ms`);
    observer.observe(target);
  });
}

/**
 * Main EDS block decorator.
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  const tag = rowText(block, 0) || 'How It Works';
  const stepRows = [2, 3, 4, 5];
  const statRows = [6, 7, 8, 9];
  const primaryAction = rowLink(block, 10) || {
    href: '#',
    text: 'Request Demo',
    target: '',
    rel: '',
  };
  const secondaryAction = rowLink(block, 11) || {
    href: '#',
    text: 'Talk to Sales',
    target: '',
    rel: '',
  };
  const defaultSteps = [
    {
      icon: '🏢',
      title: 'Set Up Your Account',
      description:
        'Create your company profile, add users with role-based permissions, and configure approval workflows to match your procurement policy.',
    },
    {
      icon: '🔍',
      title: 'Browse & Quote',
      description:
        'Search 40,000+ enterprise-grade products, request custom quotes with your negotiated pricing, and compare options side-by-side.',
    },
    {
      icon: '✅',
      title: 'Approve & Order',
      description:
        'Route purchase orders through your approval chain automatically. One-click ordering with company credit or PO against existing contracts.',
    },
    {
      icon: '📦',
      title: 'Track & Maintain',
      description:
        'Real-time shipment tracking, automated invoicing, and proactive maintenance scheduling from your unified dashboard.',
    },
  ];
  const defaultStats = [
    { value: '40K+', label: 'Products in catalog' },
    { value: '4.2K', label: 'Enterprise clients' },
    { value: '$3.4B', label: 'Annual GMV processed' },
    { value: '99.9%', label: 'Platform uptime SLA' },
  ];

  const steps = stepRows
    .map((rowIndex) => parseStep(rowParts(block, rowIndex)))
    .map((step, index) => {
      if (step.icon || step.title || step.description) return step;
      return defaultSteps[index];
    });
  const stats = statRows
    .map((rowIndex) => parseStat(rowParts(block, rowIndex)))
    .map((stat, index) => {
      if (stat.value || stat.label) return stat;
      return defaultStats[index];
    });

  const hiwSection = el('section', 'hiws-section');
  hiwSection.append(el('div', 'hiws-bg', { 'aria-hidden': 'true' }));

  const inner = el('div', 'hiws-inner');
  const tagEl = el('div', 'hiws-tag hiws-reveal', {}, [document.createTextNode(tag)]);

  const titleEl = el('h2', 'hiws-title hiws-reveal');
  const titleCell = rowCell(block, 1);
  if (titleCell) {
    titleEl.innerHTML = normalizeBreakMarkup(titleCell.innerHTML);
  } else {
    titleEl.textContent = 'From onboarding to order in under an hour';
  }

  const grid = el('div', 'hiws-grid');
  steps.forEach((step, i) => {
    grid.append(buildStep(i, step.icon, step.title, step.description));
  });

  inner.append(tagEl, titleEl, grid);
  hiwSection.append(inner);

  const statsBand = el('section', 'hiws-stats-band');
  const statsInner = el('div', 'hiws-stats-inner');
  stats.forEach((stat) => {
    statsInner.append(buildStat(stat.value, stat.label));
  });
  const actions = el('div', 'hiws-actions hiws-reveal');
  actions.append(
    buildAction(primaryAction, 'primary'),
    buildAction(secondaryAction, 'secondary'),
  );
  statsBand.append(statsInner, actions);

  block.textContent = '';
  block.append(hiwSection, statsBand);
  setupReveal(block);
}
