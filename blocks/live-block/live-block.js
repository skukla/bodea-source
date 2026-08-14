import {
  EMPTY_ACTIVITY_TEXT,
  SOURCE_STATUS,
  buildSparkline,
  escapeHtml,
  formatDateTime,
  getCommonConfig,
  metricsByGroup,
  renderChartMarkup,
  resolveHref,
  runDashboardLifecycle,
} from './dashboard-core.js';

/**
 * Render a metric group section.
 * @param {string} title
 * @param {Array<object>} metrics
 * @param {string} subtitle
 * @returns {string}
 */
function renderMetricSection(title, metrics, subtitle = '') {
  const cards = metrics.map((metric) => `
    <article class="live-block-metric${metric.isFallback ? ' is-fallback' : ''}" tabindex="0">
      <div class="live-block-metric-value">${escapeHtml(metric.value)}</div>
      <div class="live-block-metric-label">${escapeHtml(metric.label)}</div>
      ${metric.note ? `<div class="live-block-metric-note">${escapeHtml(metric.note)}</div>` : ''}
    </article>
  `).join('');

  return `
    <section class="live-block-section" aria-label="${escapeHtml(title)}">
      <header class="live-block-section-header">
        <h3 class="live-block-section-title">${escapeHtml(title)}</h3>
        ${subtitle ? `<p class="live-block-section-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      </header>
      <div class="live-block-metrics-grid">
        ${cards}
      </div>
    </section>
  `;
}

/**
 * Render an activity list card.
 * @param {string} title
 * @param {Array<object>} rows
 * @returns {string}
 */
function renderActivityCard(title, rows) {
  const items = rows.length
    ? `<ul class="live-block-activity-list">
        ${rows.map((row) => `
          <li class="live-block-activity-item" tabindex="0">
            <div class="live-block-activity-main">
              <div class="live-block-activity-title">${escapeHtml(row.title)}</div>
              <div class="live-block-activity-subtitle">${escapeHtml(row.subtitle)}</div>
              <div class="live-block-activity-date">${escapeHtml(row.date)}</div>
            </div>
            <div class="live-block-activity-amount">${escapeHtml(row.amount)}</div>
          </li>
        `).join('')}
      </ul>`
    : `<p class="live-block-empty">${EMPTY_ACTIVITY_TEXT}</p>`;

  return `
    <section class="live-block-activity-card" aria-label="${escapeHtml(title)}">
      <h3 class="live-block-activity-card-title">${escapeHtml(title)}</h3>
      ${items}
    </section>
  `;
}

/**
 * Render source health chips.
 * @param {Record<string, any>} sources
 * @returns {string}
 */
function renderSourceHealth(sources) {
  const entries = Object.entries(sources);
  const okCount = entries.filter(([, source]) => source.status === SOURCE_STATUS.OK).length;

  return `
    <section class="live-block-sources" aria-label="Data source status">
      <div class="live-block-sources-summary">${escapeHtml(`Sources live: ${okCount}/${entries.length}`)}</div>
      <ul class="live-block-sources-list">
        ${entries.map(([name, source]) => `
          <li class="live-block-source-chip is-${escapeHtml(source.status)}">
            <span class="live-block-source-name">${escapeHtml(name)}</span>
            <span class="live-block-source-status">${escapeHtml(source.status)}</span>
          </li>
        `).join('')}
      </ul>
    </section>
  `;
}

/**
 * Render guest mode.
 * @param {HTMLElement} block
 * @param {object} config
 */
function renderGuest(block, config) {
  const wrapper = document.createElement('section');
  wrapper.className = 'live-block-shell live-block-shell-guest';
  wrapper.innerHTML = `
    <header class="live-block-header">
      <h2 class="live-block-title">${escapeHtml(config.title)}</h2>
      <span class="live-block-pill">Guest</span>
    </header>
    <p class="live-block-description">Sign in to view live commerce data.</p>
    <a class="live-block-cta" href="${escapeHtml(resolveHref(config.guestCtaHref))}">${escapeHtml(config.guestCtaLabel)}</a>
  `;
  block.replaceChildren(wrapper);
}

/**
 * Render loading state.
 * @param {HTMLElement} block
 * @param {string} title
 * @param {string} message
 */
function renderLoading(block, title, message) {
  const wrapper = document.createElement('section');
  wrapper.className = 'live-block-shell live-block-shell-loading';
  wrapper.innerHTML = `
    <header class="live-block-header">
      <h2 class="live-block-title">${escapeHtml(title)}</h2>
      <span class="live-block-pill">Live</span>
    </header>
    <p class="live-block-description" role="status" aria-live="polite">${escapeHtml(message)}</p>
  `;

  block.replaceChildren(wrapper);
}

/**
 * Render authenticated dashboard state.
 * @param {HTMLElement} block
 * @param {object} config
 * @param {object} viewModel
 * @param {Function} onRefresh
 */
function renderAuthenticated(block, config, viewModel, onRefresh) {
  const financeMetrics = metricsByGroup(viewModel.metrics, 'finance');
  const operationsMetrics = metricsByGroup(viewModel.metrics, 'operations');
  const sourcingMetrics = metricsByGroup(viewModel.metrics, 'sourcing');
  const visibleCharts = config.showCharts ? viewModel.charts : [];

  const wrapper = document.createElement('section');
  wrapper.className = 'live-block-shell live-block-shell-auth';

  const hasSectionEnabled = config.showFinanceSection
    || config.showOperationsSection
    || config.showSourcingSection;

  wrapper.innerHTML = `
    <header class="live-block-header">
      <div class="live-block-header-main">
        <h2 class="live-block-title">${escapeHtml(config.title)}</h2>
        <p class="live-block-status" role="status" aria-live="polite">${escapeHtml(
    config.showLastUpdated
      ? `Last updated ${formatDateTime(viewModel.lastUpdatedAt)}`
      : 'Live commerce data loaded',
  )}</p>
      </div>
      <div class="live-block-header-actions">
        <span class="live-block-pill">Live</span>
        <button type="button" class="live-block-refresh" data-live-block-refresh>
          ${escapeHtml(config.refreshLabel)}
        </button>
      </div>
    </header>

    ${hasSectionEnabled
    ? ''
    : '<p class="live-block-empty">No dashboard sections are currently enabled.</p>'}

    ${config.showFinanceSection
    ? renderMetricSection('Finance', financeMetrics, 'Credit and cash exposure')
    : ''}

    ${config.showOperationsSection
    ? renderMetricSection(
      'Operations',
      operationsMetrics,
      `${viewModel.windows.orderWindowDays}-day windowed metrics within fetched records`,
    )
    : ''}

    ${config.showSparkline && viewModel.sparklinePoints.length >= 2
    ? '<section class="live-block-sparkline" aria-hidden="true"></section>'
    : ''}

    ${config.showSourcingSection
    ? renderMetricSection('Sourcing', sourcingMetrics, 'Buyer intent and pipeline surfaces')
    : ''}

    ${(config.showOperationsSection || config.showFinanceSection || config.showSourcingSection)
    ? `<section class="live-block-activity-grid" aria-label="Recent activity">
        ${config.showOperationsSection ? renderActivityCard('Recent Purchase Orders', viewModel.activity.purchaseOrders) : ''}
        ${config.showFinanceSection ? renderActivityCard('Recent Credit Transactions', viewModel.activity.creditHistory) : ''}
        ${config.showSourcingSection ? renderActivityCard('Recent Quotes', viewModel.activity.quotes) : ''}
      </section>`
    : ''}

    ${visibleCharts.length > 0
    ? `<section class="live-block-charts" aria-label="Dashboard charts">
        <header class="live-block-section-header">
          <h3 class="live-block-section-title">Detailed Graphs</h3>
          <p class="live-block-section-subtitle">Labeled trends and distributions</p>
        </header>
        <div class="live-block-chart-grid">
          ${visibleCharts.map((chart) => `
            <article class="live-block-chart-card" aria-label="${escapeHtml(chart.title)}">
              <header class="live-block-chart-header">
                <h4 class="live-block-chart-title">${escapeHtml(chart.title)}</h4>
                <p class="live-block-chart-description">${escapeHtml(chart.description)}</p>
              </header>
              ${renderChartMarkup(chart)}
            </article>
          `).join('')}
        </div>
      </section>`
    : ''}

    ${renderSourceHealth(viewModel.sources)}
  `;

  const sparklineContainer = wrapper.querySelector('.live-block-sparkline');
  if (sparklineContainer) {
    const sparkline = buildSparkline(viewModel.sparklinePoints);
    if (sparkline) {
      sparklineContainer.append(sparkline);
    } else {
      sparklineContainer.remove();
    }
  }

  const refreshButton = wrapper.querySelector('[data-live-block-refresh]');
  refreshButton?.addEventListener('click', () => {
    onRefresh();
  });

  block.replaceChildren(wrapper);
}

/**
 * Decorate block.
 * @param {HTMLElement} block
 */
export default async function decorate(block) {
  const config = getCommonConfig(block);

  await runDashboardLifecycle({
    block,
    config,
    renderGuest,
    renderLoading,
    renderAuthenticated,
  });
}
