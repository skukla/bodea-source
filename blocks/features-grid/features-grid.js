/**
 * features-grid block for AEM Edge Delivery Services.
 *
 * Authoring contract (2-column table):
 * row 0: section-tag
 * row 1: title
 * row 2: subtitle
 * row 3: cta-label
 * row 4: cta-url
 * row 5+: card rows in pipe format:
 *   variant | icon | tag | title | description | cta-label | cta-url | icon-bg(optional)
 */

const ICON_BG_CYCLE = ['fi-green', 'fi-gold', 'fi-blue', 'fi-green', 'fi-gold'];
const VALID_VARIANTS = new Set(['default', 'featured', 'wide']);
const VALID_ICON_BG = new Set(['fi-green', 'fi-gold', 'fi-blue', 'fi-dark']);

/**
 * Return the rendered cell for a row.
 * Falls back to column 0 for 1-column authored tables.
 * @param {HTMLElement | undefined} row
 * @param {number} col
 * @returns {HTMLElement | null}
 */
function getCell(row, col = 1) {
  if (!row) return null;
  const cells = row.querySelectorAll(':scope > div');
  return cells[col] || cells[0] || null;
}

/**
 * Get row text from the value column.
 * @param {HTMLElement | undefined} row
 * @returns {string}
 */
function cellText(row) {
  const cell = getCell(row);
  return cell ? cell.innerText.trim() : '';
}

/**
 * Parse a pipe-delimited card row.
 * @param {string} text
 * @returns {string[]}
 */
function parsePipe(text) {
  return text.split('|').map((part) => part.trim());
}

/**
 * Return icon background class based on variant and index.
 * @param {string} variant
 * @param {number} defaultIndex
 * @param {string} override
 * @returns {string}
 */
function resolveIconBg(variant, defaultIndex, override) {
  if (VALID_ICON_BG.has(override)) return override;
  if (variant === 'featured') return 'fi-dark';
  if (variant === 'wide') return 'fi-gold';
  return ICON_BG_CYCLE[defaultIndex % ICON_BG_CYCLE.length];
}

/**
 * Build card DOM element.
 * @param {object} cardData
 * @returns {HTMLElement}
 */
function buildCard(cardData) {
  const {
    variant, icon, tag, title, description, ctaLabel, ctaUrl, iconBg,
  } = cardData;

  const card = document.createElement('article');
  card.className = 'feat-card';
  card.dataset.variant = variant;

  if (variant === 'featured') {
    card.classList.add('feat-card--featured');
    card.dataset.wide = 'true';
  } else if (variant === 'wide') {
    card.classList.add('feat-card--wide');
    card.dataset.wide = 'true';
  }

  const iconEl = document.createElement('div');
  iconEl.className = `feat-icon ${iconBg}`;
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = icon || '*';

  const tagEl = document.createElement('p');
  tagEl.className = 'feat-tag';
  tagEl.textContent = tag;

  const titleEl = document.createElement('h3');
  titleEl.className = 'feat-title';
  titleEl.textContent = title;

  const descEl = document.createElement('p');
  descEl.className = 'feat-desc';
  descEl.textContent = description;

  card.append(iconEl, tagEl, titleEl, descEl);

  if (ctaLabel && ctaUrl) {
    const link = document.createElement('a');
    link.className = 'feat-link';
    link.href = ctaUrl;
    link.innerHTML = `${ctaLabel} ${svgArrow()}`;
    card.append(link);
  }

  return card;
}

/**
 * Reveal cards when they enter the viewport.
 * @param {HTMLElement[]} cards
 */
function revealCards(cards) {
  if (!cards.length) return;

  if (!('IntersectionObserver' in window)) {
    cards.forEach((card) => card.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1 });

  cards.forEach((card) => observer.observe(card));
}

/**
 * Main EDS block decorator.
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  const rows = [...block.children];
  if (rows.length < 5) return;

  const sectionTag = cellText(rows[0]);
  const titleText = cellText(rows[1]);
  const subtitleText = cellText(rows[2]);
  const ctaLabel = cellText(rows[3]);
  const ctaUrl = cellText(rows[4]);

  const parsedCards = [];
  let defaultCardIndex = 0;

  rows.slice(5).forEach((row) => {
    const raw = cellText(row);
    if (!raw) return;

    const [
      rawVariant = 'default',
      icon = '*',
      tag = '',
      title = '',
      description = '',
      ctaLabelCard = '',
      ctaUrlCard = '',
      iconBgOverride = '',
    ] = parsePipe(raw);

    const variant = rawVariant.toLowerCase();
    const safeVariant = VALID_VARIANTS.has(variant) ? variant : 'default';
    const iconBg = resolveIconBg(safeVariant, defaultCardIndex, iconBgOverride);

    if (safeVariant === 'default') defaultCardIndex += 1;

    parsedCards.push({
      variant: safeVariant,
      icon,
      tag,
      title,
      description,
      ctaLabel: ctaLabelCard,
      ctaUrl: ctaUrlCard,
      iconBg,
    });
  });

  // Stable visual ordering:
  // 1) featured card(s), 2) default cards, 3) wide card(s), 4) any unknown fallback.
  const orderedCardsData = [
    ...parsedCards.filter((card) => card.variant === 'featured'),
    ...parsedCards.filter((card) => card.variant === 'default'),
    ...parsedCards.filter((card) => card.variant === 'wide'),
    ...parsedCards.filter((card) => !VALID_VARIANTS.has(card.variant)),
  ];

  const cards = orderedCardsData.map((cardData, index) => {
    const card = buildCard(cardData);
    card.classList.add(`feat-card--slot-${index + 1}`);
    return card;
  });

  const inner = document.createElement('div');
  inner.className = 'fg-inner';

  const header = document.createElement('header');
  header.className = 'fg-header features-header';

  const headerLeft = document.createElement('div');
  headerLeft.className = 'fg-header-left';

  if (sectionTag) {
    const tagEl = document.createElement('p');
    // Keep legacy class names for cached/older CSS compatibility.
    tagEl.className = 'fg-kicker section-tag';
    tagEl.textContent = sectionTag;
    headerLeft.append(tagEl);
  }

  const heading = document.createElement('h2');
  heading.className = 'fg-title section-title';
  heading.textContent = titleText;
  // Inline safety reset protects against unexpected external heading styles.
  heading.style.margin = '0';
  heading.style.position = 'static';
  heading.style.transform = 'none';
  heading.style.lineHeight = '1.03';
  heading.style.maxWidth = '12ch';
  headerLeft.append(heading);

  const headerRight = document.createElement('div');
  headerRight.className = 'fg-header-right';

  if (subtitleText) {
    const subtitle = document.createElement('p');
    subtitle.className = 'fg-subtitle section-sub';
    subtitle.textContent = subtitleText;
    headerRight.append(subtitle);
  }

  if (ctaLabel && ctaUrl) {
    const cta = document.createElement('a');
    cta.className = 'fg-header-cta';
    cta.href = ctaUrl;
    cta.innerHTML = `${ctaLabel} ${svgArrow()}`;
    headerRight.append(cta);
  }

  header.append(headerLeft, headerRight);

  const grid = document.createElement('div');
  grid.className = 'fg-grid';
  cards.forEach((card) => grid.append(card));

  inner.append(header, grid);

  block.textContent = '';
  block.append(inner);

  revealCards(cards);
}

/**
 * Shared inline arrow icon.
 * @returns {string}
 */
function svgArrow() {
  return `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"
    viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>`;
}
