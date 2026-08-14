import { readBlockConfig } from '../../scripts/aem.js';
import {
  EMPTY_ACTIVITY_TEXT,
  FALLBACK_TEXT,
  SOURCE_STATUS,
  escapeHtml,
  formatCount,
  formatDateTime,
  formatMoney,
  getCommonConfig,
  metricsByGroup,
  parseBoolean,
  resolveHref,
  runDashboardLifecycle,
} from '../live-block/dashboard-core.js';

const PREMIUM_DEFAULTS = {
  premiumAccent: 'emerald',
  premiumSurface: 'glass',
  premiumStyle: 'classic',
  premiumMotion: true,
};

const PREMIUM_ACCENTS = new Set(['emerald', 'cyan', 'gold']);
const PREMIUM_SURFACES = new Set(['glass', 'solid']);
const PREMIUM_STYLES = new Set(['classic', 'editorial-luxe']);

/**
 * Resolve premium-specific config merged with common dashboard config.
 * @param {HTMLElement} block
 * @returns {object}
 */
function getPremiumConfig(block) {
  const common = getCommonConfig(block);
  const config = readBlockConfig(block);

  const accent = String(config['premium-accent'] || '')
    .trim()
    .toLowerCase();
  const surface = String(config['premium-surface'] || '')
    .trim()
    .toLowerCase();
  const style = String(config['premium-style'] || '')
    .trim()
    .toLowerCase();

  return {
    ...common,
    premiumAccent: PREMIUM_ACCENTS.has(accent)
      ? accent
      : PREMIUM_DEFAULTS.premiumAccent,
    premiumSurface: PREMIUM_SURFACES.has(surface)
      ? surface
      : PREMIUM_DEFAULTS.premiumSurface,
    premiumStyle: PREMIUM_STYLES.has(style)
      ? style
      : PREMIUM_DEFAULTS.premiumStyle,
    premiumMotion: parseBoolean(
      config['premium-motion'],
      PREMIUM_DEFAULTS.premiumMotion,
    ),
  };
}

/**
 * Build the shell class list for a premium block state.
 * @param {object} config
 * @param {string} stateClass
 * @returns {string}
 */
function getPremiumShellClassName(config, stateClass) {
  return [
    'live-block-premium-shell',
    stateClass,
    `accent-${config.premiumAccent}`,
    `surface-${config.premiumSurface}`,
    `style-${config.premiumStyle}`,
    config.premiumMotion ? 'motion-on' : 'motion-off',
  ].join(' ');
}

/**
 * Build sparkline element for premium header trend strip.
 * @param {Array<{value:number}>} points
 * @param {string} accentColor
 * @returns {SVGElement | null}
 */
function buildPremiumSparkline(points, accentColor) {
  if (!Array.isArray(points) || points.length < 2) return null;

  const width = 360;
  const height = 92;
  const topPadding = 14;
  const bottomPadding = 14;
  const availableHeight = height - topPadding - bottomPadding;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const stepX = width / (points.length - 1);

  const coordinates = values.map((point, index) => {
    const x = Math.round(index * stepX * 100) / 100;
    const normalized = (point - min) / range;
    const y = Math.round((height - bottomPadding - (normalized * availableHeight)) * 100) / 100;
    return [x, y];
  });

  const linePath = coordinates
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`)
    .join(' ');

  const areaPath = `${linePath} L${width} ${height} L0 ${height} Z`;
  const [lastX, lastY] = coordinates[coordinates.length - 1];

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('live-block-premium-sparkline-svg');

  const gradientId = `live-block-premium-grad-${Math.random().toString(36).slice(2, 10)}`;
  const defs = document.createElementNS(ns, 'defs');
  const gradient = document.createElementNS(ns, 'linearGradient');
  gradient.setAttribute('id', gradientId);
  gradient.setAttribute('x1', '0');
  gradient.setAttribute('y1', '0');
  gradient.setAttribute('x2', '0');
  gradient.setAttribute('y2', '1');

  const stopA = document.createElementNS(ns, 'stop');
  stopA.setAttribute('offset', '0%');
  stopA.setAttribute('stop-color', accentColor);
  stopA.setAttribute('stop-opacity', '0.38');

  const stopB = document.createElementNS(ns, 'stop');
  stopB.setAttribute('offset', '100%');
  stopB.setAttribute('stop-color', accentColor);
  stopB.setAttribute('stop-opacity', '0');

  gradient.append(stopA, stopB);
  defs.append(gradient);

  const area = document.createElementNS(ns, 'path');
  area.setAttribute('d', areaPath);
  area.setAttribute('fill', `url(#${gradientId})`);

  const line = document.createElementNS(ns, 'path');
  line.setAttribute('d', linePath);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', accentColor);
  line.setAttribute('stroke-width', '2.8');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');

  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('cx', String(lastX));
  dot.setAttribute('cy', String(lastY));
  dot.setAttribute('r', '4.4');
  dot.setAttribute('fill', accentColor);

  svg.append(defs, area, line, dot);
  return svg;
}

/**
 * Render a premium metric card.
 * @param {object} metric
 * @returns {string}
 */
function renderPremiumMetric(metric) {
  return `
    <article class="live-block-premium-metric${metric.isFallback ? ' is-fallback' : ''}" tabindex="0">
      <div class="live-block-premium-metric-label">${escapeHtml(metric.label)}</div>
      <div class="live-block-premium-metric-value">${escapeHtml(metric.value)}</div>
      ${metric.note ? `<div class="live-block-premium-metric-note">${escapeHtml(metric.note)}</div>` : ''}
    </article>
  `;
}

/**
 * Render status chips for source health.
 * @param {Record<string, any>} sources
 * @returns {string}
 */
function renderPremiumSources(sources) {
  const entries = Object.entries(sources);
  const okCount = entries.filter(([, source]) => source.status === SOURCE_STATUS.OK).length;

  return `
    <section class="live-block-premium-sources" aria-label="Data source status">
      <div class="live-block-premium-sources-title">${escapeHtml(`Connected sources ${okCount}/${entries.length}`)}</div>
      <ul class="live-block-premium-sources-list">
        ${entries.map(([name, source]) => `
          <li class="live-block-premium-source-chip is-${escapeHtml(source.status)}">
            <span>${escapeHtml(name)}</span>
            <strong>${escapeHtml(source.status)}</strong>
          </li>
        `).join('')}
      </ul>
    </section>
  `;
}

/**
 * Render activity panel.
 * @param {string} title
 * @param {Array<object>} rows
 * @returns {string}
 */
function renderPremiumActivity(title, rows) {
  const items = rows.length
    ? `<ul class="live-block-premium-activity-list">
        ${rows.map((row) => `
          <li class="live-block-premium-activity-item" tabindex="0">
            <div class="live-block-premium-activity-main">
              <div class="live-block-premium-activity-title">${escapeHtml(row.title)}</div>
              <div class="live-block-premium-activity-sub">${escapeHtml(row.subtitle)}</div>
              <div class="live-block-premium-activity-date">${escapeHtml(row.date)}</div>
            </div>
            <div class="live-block-premium-activity-amount">${escapeHtml(row.amount)}</div>
          </li>
        `).join('')}
      </ul>`
    : `<p class="live-block-premium-empty">${EMPTY_ACTIVITY_TEXT}</p>`;

  return `
    <section class="live-block-premium-activity-card" aria-label="${escapeHtml(title)}">
      <h3>${escapeHtml(title)}</h3>
      ${items}
    </section>
  `;
}

/**
 * Render a premium chart card from normalized chart model.
 * @param {object} chart
 * @returns {string}
 */
function renderPremiumChart(chart) {
  if (chart.state !== 'ready') {
    return `
      <article class="live-block-premium-chart-card" aria-label="${escapeHtml(chart.title)}">
        <header>
          <h4>${escapeHtml(chart.title)}</h4>
          <p>${escapeHtml(chart.description)}</p>
        </header>
        <p class="live-block-premium-empty" role="status">${escapeHtml(chart.emptyText || FALLBACK_TEXT)}</p>
      </article>
    `;
  }

  if (chart.type === 'donut') {
    const total = chart.entries.reduce((sum, entry) => sum + entry.value, 0);
    return `
      <article class="live-block-premium-chart-card" aria-label="${escapeHtml(chart.title)}">
        <header>
          <h4>${escapeHtml(chart.title)}</h4>
          <p>${escapeHtml(chart.description)}</p>
        </header>
        <div class="live-block-premium-chart-stats">
          <div class="live-block-premium-chart-stat-value">${escapeHtml(formatCount(total))}</div>
          <div class="live-block-premium-chart-stat-label">Total</div>
        </div>
        <ul class="live-block-premium-chart-list">
          ${chart.entries.map((entry) => `
            <li>
              <span>${escapeHtml(entry.label)}</span>
              <strong>${escapeHtml(formatCount(entry.value))}</strong>
            </li>
          `).join('')}
        </ul>
      </article>
    `;
  }

  if (chart.type === 'line') {
    const { points } = chart;
    const values = points.map((point) => point.value);
    const max = Math.max(...values);
    const min = Math.min(...values);

    const bars = points.map((point) => {
      const range = Math.max(max - min, 1);
      const heightPercent = 20 + (((point.value - min) / range) * 80);
      return `
        <li>
          <span style="height:${heightPercent.toFixed(2)}%"></span>
          <em>${escapeHtml(point.label)}</em>
        </li>
      `;
    }).join('');

    return `
      <article class="live-block-premium-chart-card" aria-label="${escapeHtml(chart.title)}">
        <header>
          <h4>${escapeHtml(chart.title)}</h4>
          <p>${escapeHtml(chart.description)}</p>
        </header>
        <div class="live-block-premium-chart-range">
          <strong>${escapeHtml(formatMoney(max, chart.currency))}</strong>
          <span>${escapeHtml(formatMoney(min, chart.currency))}</span>
        </div>
        <ul class="live-block-premium-mini-bars" aria-hidden="true">
          ${bars}
        </ul>
      </article>
    `;
  }

  const { entries } = chart;
  return `
    <article class="live-block-premium-chart-card" aria-label="${escapeHtml(chart.title)}">
      <header>
        <h4>${escapeHtml(chart.title)}</h4>
        <p>${escapeHtml(chart.description)}</p>
      </header>
      <ul class="live-block-premium-chart-list">
        ${entries.map((entry) => `
          <li>
            <span>${escapeHtml(entry.label)}</span>
            <strong>${escapeHtml(formatCount(entry.value))}</strong>
          </li>
        `).join('')}
      </ul>
    </article>
  `;
}

/**
 * Render guest state.
 * @param {HTMLElement} block
 * @param {object} config
 */
function renderGuest(block, config) {
  const wrapper = document.createElement('section');
  wrapper.className = getPremiumShellClassName(config, 'live-block-premium-shell-guest');
  wrapper.innerHTML = `
    <header class="live-block-premium-header">
      <h2>${escapeHtml(config.title)}</h2>
      <span class="live-block-premium-pill">Premium</span>
    </header>
    <p class="live-block-premium-description">Sign in to unlock your premium commerce dashboard.</p>
    <a class="live-block-premium-cta" href="${escapeHtml(resolveHref(config.guestCtaHref))}">${escapeHtml(config.guestCtaLabel)}</a>
  `;
  block.replaceChildren(wrapper);
}

/**
 * Render loading state.
 * @param {HTMLElement} block
 * @param {object} config
 * @param {string} title
 * @param {string} message
 */
function renderLoading(block, config, title, message) {
  const wrapper = document.createElement('section');
  wrapper.className = getPremiumShellClassName(config, 'live-block-premium-shell-loading');
  wrapper.innerHTML = `
    <header class="live-block-premium-header">
      <h2>${escapeHtml(title)}</h2>
      <span class="live-block-premium-pill">Premium</span>
    </header>
    <p class="live-block-premium-description" role="status" aria-live="polite">${escapeHtml(message)}</p>
  `;

  block.replaceChildren(wrapper);
}

/**
 * Render authenticated premium dashboard.
 * @param {HTMLElement} block
 * @param {object} config
 * @param {object} viewModel
 * @param {Function} onRefresh
 */
function renderAuthenticated(block, config, viewModel, onRefresh) {
  const financeMetrics = metricsByGroup(viewModel.metrics, 'finance');
  const operationsMetrics = metricsByGroup(viewModel.metrics, 'operations');
  const sourcingMetrics = metricsByGroup(viewModel.metrics, 'sourcing');

  const wrapper = document.createElement('section');
  wrapper.className = getPremiumShellClassName(config, 'live-block-premium-shell-auth');

  const heroMetricIds = ['creditAvailable', 'ordersTotal', 'openQuotes'];
  const heroMetrics = heroMetricIds
    .map((id) => viewModel.metrics[id])
    .filter(Boolean);

  wrapper.innerHTML = `
    <header class="live-block-premium-header">
      <div class="live-block-premium-header-main">
        <p class="live-block-premium-kicker">Executive Mode</p>
        <h2>${escapeHtml(config.title)}</h2>
        <p class="live-block-premium-description" role="status" aria-live="polite">${escapeHtml(
    config.showLastUpdated
      ? `Last updated ${formatDateTime(viewModel.lastUpdatedAt)}`
      : 'Live commerce data loaded',
  )}</p>
      </div>
      <div class="live-block-premium-header-actions">
        <span class="live-block-premium-pill">Premium</span>
        <button type="button" class="live-block-premium-refresh" data-live-block-premium-refresh>
          ${escapeHtml(config.refreshLabel)}
        </button>
      </div>
    </header>

    <section class="live-block-premium-hero-metrics" aria-label="Top indicators">
      ${heroMetrics.map((metric) => renderPremiumMetric(metric)).join('')}
    </section>

    ${config.showSparkline && viewModel.sparklinePoints.length >= 2
    ? '<section class="live-block-premium-sparkline" aria-hidden="true"></section>'
    : ''}

    ${config.showFinanceSection
    ? `<section class="live-block-premium-section" aria-label="Finance">
        <header><h3>Finance</h3><p>Credit and exposure metrics</p></header>
        <div class="live-block-premium-metrics-grid">
          ${financeMetrics.map((metric) => renderPremiumMetric(metric)).join('')}
        </div>
      </section>`
    : ''}

    ${config.showOperationsSection
    ? `<section class="live-block-premium-section" aria-label="Operations">
        <header><h3>Operations</h3><p>${escapeHtml(`${viewModel.windows.orderWindowDays}-day window within fetched records`)}</p></header>
        <div class="live-block-premium-metrics-grid">
          ${operationsMetrics.map((metric) => renderPremiumMetric(metric)).join('')}
        </div>
      </section>`
    : ''}

    ${config.showSourcingSection
    ? `<section class="live-block-premium-section" aria-label="Sourcing">
        <header><h3>Sourcing</h3><p>Pipeline and buyer intent surfaces</p></header>
        <div class="live-block-premium-metrics-grid">
          ${sourcingMetrics.map((metric) => renderPremiumMetric(metric)).join('')}
        </div>
      </section>`
    : ''}

    ${(config.showOperationsSection || config.showFinanceSection || config.showSourcingSection)
    ? `<section class="live-block-premium-activity-grid" aria-label="Recent activity">
        ${config.showOperationsSection ? renderPremiumActivity('Recent Purchase Orders', viewModel.activity.purchaseOrders) : ''}
        ${config.showFinanceSection ? renderPremiumActivity('Recent Credit Transactions', viewModel.activity.creditHistory) : ''}
        ${config.showSourcingSection ? renderPremiumActivity('Recent Quotes', viewModel.activity.quotes) : ''}
      </section>`
    : ''}

    ${config.showCharts
    ? `<section class="live-block-premium-charts" aria-label="Detailed charts">
        <header><h3>Premium Analytics</h3><p>Labeled trends and status distributions</p></header>
        <div class="live-block-premium-chart-grid">
          ${viewModel.charts.map((chart) => renderPremiumChart(chart)).join('')}
        </div>
      </section>`
    : ''}

    ${renderPremiumSources(viewModel.sources)}
  `;

  const sparklineContainer = wrapper.querySelector('.live-block-premium-sparkline');
  if (sparklineContainer) {
    const accent = getComputedStyle(wrapper).getPropertyValue('--live-premium-accent').trim() || '#22c55e';
    const sparkline = buildPremiumSparkline(viewModel.sparklinePoints, accent);
    if (sparkline) {
      sparklineContainer.append(sparkline);
    } else {
      sparklineContainer.remove();
    }
  }

  const refreshButton = wrapper.querySelector('[data-live-block-premium-refresh]');
  refreshButton?.addEventListener('click', () => {
    onRefresh();
  });

  block.replaceChildren(wrapper);
}

/**
 * Decorate premium live block.
 * @param {HTMLElement} block
 */
export default async function decorate(block) {
  const config = getPremiumConfig(block);

  await runDashboardLifecycle({
    block,
    config,
    renderGuest,
    renderLoading: (targetBlock, title, message) => renderLoading(
      targetBlock,
      config,
      title,
      message,
    ),
    renderAuthenticated,
  });
}
