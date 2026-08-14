/**
 * Hero-5 block for EDS document authoring.
 *
 * Table contract (1 column, 15 rows after block name):
 * 0 eyebrow
 * 1 title (supports strong/del markdown authored in doc)
 * 2 subtitle
 * 3 primary CTA link
 * 4 secondary CTA link
 * 5 trust text
 * 6 badge value
 * 7 badge label
 * 8 metric 1: value | label | delta
 * 9 metric 2: value | label | delta
 * 10 metric 3: value | label | delta
 * 11 order 1: name | sub-label | amount
 * 12 order 2: name | sub-label | amount
 * 13 order 3: name | sub-label | amount
 * 14 floating notice
 */

/**
 * Read authored row text.
 * @param {HTMLElement} block
 * @param {number} rowIndex
 * @returns {string}
 */
function rowText(block, rowIndex) {
  const row = block.children[rowIndex];
  if (!row) return '';
  const cell = row.querySelector('div') || row;
  return cell.innerText.trim();
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
 * Build sparkline SVG used inside the dashboard card.
 * @param {string} gradientId
 * @returns {SVGElement}
 */
function buildSparkline(gradientId) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 320 60');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const defs = document.createElementNS(ns, 'defs');
  const gradient = document.createElementNS(ns, 'linearGradient');
  gradient.id = gradientId;
  gradient.setAttribute('x1', '0');
  gradient.setAttribute('y1', '0');
  gradient.setAttribute('x2', '0');
  gradient.setAttribute('y2', '1');

  const stop1 = document.createElementNS(ns, 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.setAttribute('stop-color', '#26a067');
  stop1.setAttribute('stop-opacity', '.4');

  const stop2 = document.createElementNS(ns, 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('stop-color', '#26a067');
  stop2.setAttribute('stop-opacity', '0');

  gradient.append(stop1, stop2);
  defs.append(gradient);
  svg.append(defs);

  const linePath = 'M0 45 L30 40 L70 35 L110 28 L150 32 L190 20 L230 18 L270 10 L320 8';

  const area = document.createElementNS(ns, 'path');
  area.setAttribute('d', `${linePath} L320 60 L0 60Z`);
  area.setAttribute('fill', `url(#${gradientId})`);

  const line = document.createElementNS(ns, 'path');
  line.setAttribute('d', linePath);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#26a067');
  line.setAttribute('stroke-width', '2.5');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');

  const halo = document.createElementNS(ns, 'circle');
  halo.setAttribute('cx', '320');
  halo.setAttribute('cy', '8');
  halo.setAttribute('r', '8');
  halo.setAttribute('fill', 'rgba(46,190,122,.2)');

  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('cx', '320');
  dot.setAttribute('cy', '8');
  dot.setAttribute('r', '4');
  dot.setAttribute('fill', '#2ebe7a');

  svg.append(area, line, halo, dot);
  return svg;
}

/**
 * Apply CTA classes and append inline icon once.
 * @param {HTMLAnchorElement | null | undefined} anchor
 * @param {string} className
 * @param {string} iconMarkup
 * @returns {HTMLAnchorElement | null}
 */
function decorateCta(anchor, className, iconMarkup) {
  if (!anchor) return null;
  anchor.className = className;
  if (!anchor.querySelector('svg')) {
    anchor.insertAdjacentHTML('beforeend', iconMarkup);
  }
  return anchor;
}

/**
 * Main EDS block decorator.
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  const eyebrow = rowText(block, 0);
  const titleRaw = rowText(block, 1);
  const subtitle = rowText(block, 2);
  const ctaPrimary = decorateCta(block.children[3]?.querySelector('a'), 'hero-cta', svgArrow());
  const ctaSecondary = decorateCta(block.children[4]?.querySelector('a'), 'hero-cta-outline', svgPlay());
  const trustText = block.children[5]?.querySelector('div') || null;
  const badgeValue = rowText(block, 6);
  const badgeLabel = rowText(block, 7);
  const [m1v, m1l, m1d] = rowParts(block, 8);
  const [m2v, m2l, m2d] = rowParts(block, 9);
  const [m3v, m3l, m3d] = rowParts(block, 10);
  const [o1name, o1sub, o1amt] = rowParts(block, 11);
  const [o2name, o2sub, o2amt] = rowParts(block, 12);
  const [o3name, o3sub, o3amt] = rowParts(block, 13);
  const noticeText = rowText(block, 14);

  const mesh = el('div', 'hero-mesh', { 'aria-hidden': 'true' });
  const grid = el('div', 'hero-grid', { 'aria-hidden': 'true' });
  const glow = el('div', 'hero-glow', { 'aria-hidden': 'true' });
  const orbs = el('div', 'hero-orbs', { 'aria-hidden': 'true' });
  [1, 2, 3, 4, 5].forEach((n) => orbs.append(el('div', `orb orb-${n}`)));

  const tagDot = el('div', 'hero-tag-dot', { 'aria-hidden': 'true' });
  const tag = el('div', 'hero-tag', {}, [tagDot, document.createTextNode(` ${eyebrow}`)]);

  const titleEl = el('h1', 'hero-title');
  const titleSource = block.children[1]?.querySelector('div');
  if (titleSource) {
    titleEl.innerHTML = titleSource.innerHTML
      .replace(/<strong>(.*?)<\/strong>/gi, '<span class="hero-title-green">$1</span>')
      .replace(/<del>(.*?)<\/del>/gi, '<span class="hero-title-outline">$1</span>');
  } else {
    titleEl.textContent = titleRaw;
  }

  const subtitleEl = el('p', 'hero-sub', {}, [document.createTextNode(subtitle)]);

  const heroActions = el('div', 'hero-actions');
  if (ctaPrimary) heroActions.append(ctaPrimary);
  if (ctaSecondary) heroActions.append(ctaSecondary);

  const trustAvatars = el('div', 'trust-avatars');
  ['J', 'M', 'A', 'R'].forEach((letter) => {
    trustAvatars.append(el('div', 'trust-av', {}, [document.createTextNode(letter)]));
  });

  const starsEl = el('div', 'trust-stars', {}, [document.createTextNode('★★★★★')]);
  const trustMsg = el('div');
  if (trustText) {
    trustMsg.innerHTML = trustText.innerHTML;
  } else {
    trustMsg.textContent = 'Trusted by enterprise teams globally';
  }

  const trustTextWrap = el('div', 'trust-text', {}, [starsEl, trustMsg]);
  const trustRow = el('div', 'hero-trust', {}, [trustAvatars, trustTextWrap]);
  const heroLeft = el('div', 'hero-left', {}, [tag, titleEl, subtitleEl, heroActions, trustRow]);

  const floatBadge = el('div', 'hero-float-badge', { 'aria-label': `${badgeValue} ${badgeLabel}` }, [
    el('div', 'hfb-icon', { 'aria-hidden': 'true' }, [document.createTextNode('📈')]),
    el('div', 'hfb-text', {}, [
      el('div', 'hfb-val', {}, [document.createTextNode(badgeValue)]),
      el('div', 'hfb-label', {}, [document.createTextNode(badgeLabel)]),
    ]),
  ]);

  const cardHeader = el('div', 'hero-card-header', {}, [
    el('span', 'hero-card-title', {}, [document.createTextNode('ServerSavvy Solutions · Dashboard')]),
    el('span', 'hc-badge', {}, [document.createTextNode('Live')]),
  ]);

  const metricRow = el('div', 'hero-metric-row', {}, [
    buildMetric(m1v, m1l, m1d),
    buildMetric(m2v, m2l, m2d),
    buildMetric(m3v, m3l, m3d),
  ]);

  const chartWrap = el('div', 'mini-chart', { 'aria-hidden': 'true' });
  const gradientId = `hero5-chart-grad-${Math.random().toString(36).slice(2, 10)}`;
  chartWrap.append(buildSparkline(gradientId));

  const orderDots = ['dot-active', 'dot-warn', 'dot-neutral'];
  const ordersData = [
    [o1name, o1sub, o1amt],
    [o2name, o2sub, o2amt],
    [o3name, o3sub, o3amt],
  ];

  const ordersList = el(
    'div',
    'hc-orders',
    {},
    ordersData.map(([name, sub, amount], i) => buildOrderRow(name, sub, amount, orderDots[i])),
  );

  const heroCard = el('div', 'hero-card', {}, [cardHeader, metricRow, chartWrap, ordersList]);

  const floatBadge2 = el('div', 'hero-float-badge2', { role: 'status' }, [
    el('div', 'hfb2-dot', { 'aria-hidden': 'true' }),
    el('div', 'hfb2-text', {}, [document.createTextNode(noticeText)]),
  ]);

  const heroRight = el('div', 'hero-right', {}, [floatBadge, heroCard, floatBadge2]);
  const heroInner = el('div', 'hero-inner', {}, [heroLeft, heroRight]);

  const scrollDot = el('div', 'scroll-wheel-dot');
  const scrollWheel = el('div', 'scroll-wheel', { 'aria-hidden': 'true' }, [scrollDot]);
  const scrollEl = el('div', 'hero-scroll', { 'aria-hidden': 'true' }, [
    scrollWheel,
    document.createTextNode('Scroll'),
  ]);

  block.textContent = '';
  block.append(mesh, grid, glow, orbs, heroInner, scrollEl);
}

/**
 * Tiny element factory.
 * @param {string} tag
 * @param {string} className
 * @param {Record<string, string>} attrs
 * @param {Array<HTMLElement | Text | SVGElement>} children
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
 * Build one metric item inside the dashboard preview card.
 * @param {string} value
 * @param {string} label
 * @param {string} delta
 * @returns {HTMLElement}
 */
function buildMetric(value, label, delta) {
  return el('div', 'hm-item', {}, [
    el('div', 'hm-val', {}, [document.createTextNode(value || '')]),
    el('div', 'hm-label', {}, [document.createTextNode(label || '')]),
    el('div', 'hm-delta', {}, [document.createTextNode(delta || '')]),
  ]);
}

/**
 * Build one order row inside the dashboard preview card.
 * @param {string} name
 * @param {string} sub
 * @param {string} amount
 * @param {string} dotClass
 * @returns {HTMLElement}
 */
function buildOrderRow(name, sub, amount, dotClass) {
  return el('div', 'hc-order', {}, [
    el('div', `hc-order-dot ${dotClass}`, { 'aria-hidden': 'true' }),
    el('div', 'hc-order-text', {}, [
      el('div', 'hc-order-name', {}, [document.createTextNode(name || '')]),
      el('div', 'hc-order-sub', {}, [document.createTextNode(sub || '')]),
    ]),
    el('div', 'hc-order-amount', {}, [document.createTextNode(amount || '')]),
  ]);
}

/** @returns {string} */
function svgArrow() {
  return '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
}

/** @returns {string} */
function svgPlay() {
  return '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
}
