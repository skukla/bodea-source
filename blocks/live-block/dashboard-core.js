import { events } from '@dropins/tools/event-bus.js';
import { readBlockConfig } from '../../scripts/aem.js';
import {
  checkIsAuthenticated,
  CUSTOMER_LOGIN_PATH,
  rootLink,
} from '../../scripts/commerce.js';

export const COMMON_DEFAULT_CONFIG = {
  title: 'Live Commerce Dashboard',
  guestCtaLabel: 'Sign in',
  guestCtaHref: CUSTOMER_LOGIN_PATH,
  rowsLimit: 3,
  showSparkline: true,
  orderWindowDays: 90,
  trendPoints: 12,
  showFinanceSection: true,
  showOperationsSection: true,
  showSourcingSection: true,
  showCharts: true,
  showLastUpdated: true,
  refreshLabel: 'Refresh data',
};

export const COMMON_LIMITS = {
  rowsLimit: { min: 1, max: 5 },
  orderWindowDays: { min: 30, max: 365 },
  trendPoints: { min: 6, max: 24 },
};

export const FALLBACK_TEXT = 'Not available';
const MIXED_CURRENCY_TEXT = 'Mixed currency';
export const EMPTY_ACTIVITY_TEXT = 'No recent commerce activity';
const TERMINAL_QUOTE_STATUSES = new Set([
  'ORDERED',
  'CLOSED',
  'DECLINED',
  'EXPIRED',
  'INACTIVE',
  'CANCELED',
]);

const CHART_COLORS = [
  '#34d399',
  '#818cf8',
  '#38bdf8',
  '#f59e0b',
  '#a78bfa',
  '#2dd4bf',
  '#fb923c',
  '#67e8f9',
];

export const SOURCE_STATUS = {
  OK: 'ok',
  ERROR: 'error',
  SKIPPED: 'skipped',
};

/**
 * Escape string to safe HTML.
 * @param {string | number | undefined | null} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Parse value to boolean.
 * @param {string | boolean | undefined} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
export function parseBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

/**
 * Parse integer with clamp.
 * @param {string | number | undefined} value
 * @param {number} fallback
 * @param {{ min: number, max: number }} range
 * @returns {number}
 */
export function parseIntInRange(value, fallback, range) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(range.min, Math.min(range.max, parsed));
}

/**
 * Build block configuration from authored values.
 * @param {HTMLElement} block
 * @returns {object}
 */
export function getCommonConfig(block) {
  const config = readBlockConfig(block);
  return {
    title: config.title?.trim() || COMMON_DEFAULT_CONFIG.title,
    guestCtaLabel: config['guest-cta-label']?.trim() || COMMON_DEFAULT_CONFIG.guestCtaLabel,
    guestCtaHref: config['guest-cta-href']?.trim() || COMMON_DEFAULT_CONFIG.guestCtaHref,
    rowsLimit: parseIntInRange(
      config['rows-limit'],
      COMMON_DEFAULT_CONFIG.rowsLimit,
      COMMON_LIMITS.rowsLimit,
    ),
    showSparkline: parseBoolean(config['show-sparkline'], COMMON_DEFAULT_CONFIG.showSparkline),
    orderWindowDays: parseIntInRange(
      config['order-window-days'],
      COMMON_DEFAULT_CONFIG.orderWindowDays,
      COMMON_LIMITS.orderWindowDays,
    ),
    trendPoints: parseIntInRange(
      config['trend-points'],
      COMMON_DEFAULT_CONFIG.trendPoints,
      COMMON_LIMITS.trendPoints,
    ),
    showFinanceSection: parseBoolean(
      config['show-finance-section'],
      COMMON_DEFAULT_CONFIG.showFinanceSection,
    ),
    showOperationsSection: parseBoolean(
      config['show-operations-section'],
      COMMON_DEFAULT_CONFIG.showOperationsSection,
    ),
    showSourcingSection: parseBoolean(
      config['show-sourcing-section'],
      COMMON_DEFAULT_CONFIG.showSourcingSection,
    ),
    showCharts: parseBoolean(config['show-charts'], COMMON_DEFAULT_CONFIG.showCharts),
    showLastUpdated: parseBoolean(
      config['show-last-updated'],
      COMMON_DEFAULT_CONFIG.showLastUpdated,
    ),
    refreshLabel: config['refresh-label']?.trim() || COMMON_DEFAULT_CONFIG.refreshLabel,
  };
}

/**
 * Convert configured href to localized route when needed.
 * @param {string} href
 * @returns {string}
 */
export function resolveHref(href) {
  if (!href) return rootLink(CUSTOMER_LOGIN_PATH);
  if (href.startsWith('/')) return rootLink(href);
  return href;
}

/**
 * Parse ISO-like date safely.
 * @param {string | undefined} value
 * @returns {Date | null}
 */
function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * Format date for human labels.
 * @param {string | Date | undefined} value
 * @returns {string}
 */
function formatDate(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return FALLBACK_TEXT;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Format datetime for status text.
 * @param {string | Date | undefined} value
 * @returns {string}
 */
export function formatDateTime(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return FALLBACK_TEXT;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format monetary amount.
 * @param {number | undefined} amount
 * @param {string | undefined} currency
 * @returns {string}
 */
export function formatMoney(amount, currency) {
  if (typeof amount !== 'number' || Number.isNaN(amount) || !currency) return FALLBACK_TEXT;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Format integer count.
 * @param {number | undefined} value
 * @returns {string}
 */
export function formatCount(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return FALLBACK_TEXT;
  return value.toLocaleString('en-US');
}

/**
 * Format percent text.
 * @param {number | undefined} value
 * @returns {string}
 */
function formatPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return FALLBACK_TEXT;
  return `${value.toFixed(1)}%`;
}

/**
 * Convert status code to display label.
 * @param {string | undefined} status
 * @returns {string}
 */
function formatStatus(status) {
  if (!status) return FALLBACK_TEXT;
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Normalize source status for monitoring in UI.
 * @param {Record<string, any>} sources
 * @param {string} source
 * @param {string} status
 * @param {object} [extra]
 */
function setSourceStatus(sources, source, status, extra = {}) {
  sources[source] = {
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

/**
 * Execute a request and persist source-level status.
 * @param {Record<string, any>} sources
 * @param {string} source
 * @param {Function | null} requestFn
 * @param {string} [missingReason]
 * @returns {Promise<any | null>}
 */
async function safeRequest(sources, source, requestFn, missingReason = 'Unavailable') {
  if (typeof requestFn !== 'function') {
    setSourceStatus(sources, source, SOURCE_STATUS.ERROR, { message: missingReason });
    return null;
  }

  try {
    const data = await requestFn();
    setSourceStatus(sources, source, SOURCE_STATUS.OK, {
      isEmpty: data == null,
    });
    return data ?? null;
  } catch (error) {
    console.warn(`live-block: ${source} request failed`, error);
    setSourceStatus(sources, source, SOURCE_STATUS.ERROR, {
      message: error?.message || 'Request failed',
    });
    return null;
  }
}

/**
 * Mark source as skipped for visibility.
 * @param {Record<string, any>} sources
 * @param {string} source
 * @param {string} reason
 */
function markSkippedSource(sources, source, reason) {
  setSourceStatus(sources, source, SOURCE_STATUS.SKIPPED, { reason });
}

/**
 * Try to import a module without throwing.
 * @param {Function} importer
 * @returns {Promise<any | null>}
 */
async function safeImport(importer) {
  try {
    return await importer();
  } catch (error) {
    console.warn('live-block: import failed', error);
    return null;
  }
}

/**
 * Determine data dependencies based on section flags.
 * @param {object} config
 * @returns {object}
 */
export function getRequirements(config) {
  const hasActiveSection = config.showFinanceSection
    || config.showOperationsSection
    || config.showSourcingSection;

  return {
    hasActiveSection,
    orders: config.showFinanceSection
      || config.showOperationsSection
      || config.showCharts
      || config.showSparkline,
    purchaseOrders: config.showOperationsSection || config.showCharts,
    myApprovals: config.showOperationsSection,
    companyPurchaseOrders: config.showOperationsSection || config.showCharts,
    companyCredit: config.showFinanceSection,
    companyCreditHistory: config.showFinanceSection || config.showCharts,
    cart: config.showSourcingSection,
    companyUsers: config.showOperationsSection || config.showCharts,
    negotiableQuotes: config.showSourcingSection || config.showCharts,
    quoteTemplates: config.showSourcingSection,
    requisitionLists: config.showSourcingSection,
    wishlists: config.showSourcingSection,
  };
}

/**
 * Initialize only required drop-ins.
 * @param {object} requirements
 */
export async function initializeRequiredDropins(requirements) {
  const initializers = [];

  if (requirements.orders) {
    initializers.push(import('../../scripts/initializers/account.js'));
  }

  if (
    requirements.companyCredit
    || requirements.companyCreditHistory
    || requirements.companyUsers
  ) {
    initializers.push(import('../../scripts/initializers/company.js'));
  }

  if (
    requirements.purchaseOrders
    || requirements.myApprovals
    || requirements.companyPurchaseOrders
  ) {
    initializers.push(import('../../scripts/initializers/purchase-order.js'));
  }

  if (requirements.cart) {
    initializers.push(import('../../scripts/initializers/cart.js'));
  }

  if (requirements.negotiableQuotes || requirements.quoteTemplates) {
    initializers.push(import('../../scripts/initializers/quote-management.js'));
  }

  if (requirements.requisitionLists) {
    initializers.push(import('../../scripts/initializers/requisition-list.js'));
  }

  if (requirements.wishlists) {
    initializers.push(import('../../scripts/initializers/wishlist.js'));
  }

  const settled = await Promise.allSettled(initializers);
  settled
    .filter((result) => result.status === 'rejected')
    .forEach((result) => {
      console.warn('live-block: initializer failed', result.reason);
    });
}

/**
 * Load APIs required by current config.
 * @param {object} requirements
 * @returns {Promise<object>}
 */
export async function loadRequiredApis(requirements) {
  const [
    accountApi,
    companyApi,
    purchaseOrderApi,
    cartApi,
    quoteApi,
    requisitionApi,
    wishlistApi,
  ] = await Promise.all([
    requirements.orders ? safeImport(() => import('@dropins/storefront-account/api.js')) : null,
    (requirements.companyCredit || requirements.companyCreditHistory || requirements.companyUsers)
      ? safeImport(() => import('@dropins/storefront-company-management/api.js'))
      : null,
    (requirements.purchaseOrders || requirements.myApprovals || requirements.companyPurchaseOrders)
      ? safeImport(() => import('@dropins/storefront-purchase-order/api.js'))
      : null,
    requirements.cart ? safeImport(() => import('@dropins/storefront-cart/api.js')) : null,
    (requirements.negotiableQuotes || requirements.quoteTemplates)
      ? safeImport(() => import('@dropins/storefront-quote-management/api.js'))
      : null,
    requirements.requisitionLists
      ? safeImport(() => import('@dropins/storefront-requisition-list/api.js'))
      : null,
    requirements.wishlists
      ? safeImport(() => import('@dropins/storefront-wishlist/api.js'))
      : null,
  ]);

  return {
    accountApi,
    companyApi,
    purchaseOrderApi,
    cartApi,
    quoteApi,
    requisitionApi,
    wishlistApi,
  };
}

/**
 * Fetch all requested data sources.
 * @param {object} requirements
 * @param {object} apis
 * @param {object} config
 * @param {Record<string, any>} sources
 * @returns {Promise<object>}
 */
export async function fetchDashboardData(requirements, apis, config, sources) {
  const orderHistoryPromise = requirements.orders
    ? safeRequest(
      sources,
      'orderHistory',
      apis.accountApi ? () => apis.accountApi.getOrderHistoryList(50, 'viewAll', 1) : null,
      'Account API unavailable',
    )
    : Promise.resolve(markSkippedSource(sources, 'orderHistory', 'Orders section disabled'));

  const companyCreditPromise = requirements.companyCredit
    ? safeRequest(
      sources,
      'companyCredit',
      apis.companyApi ? () => apis.companyApi.getCompanyCredit() : null,
      'Company API unavailable',
    )
    : Promise.resolve(markSkippedSource(sources, 'companyCredit', 'Finance section disabled'));

  const companyCreditHistoryPromise = requirements.companyCreditHistory
    ? safeRequest(
      sources,
      'companyCreditHistory',
      apis.companyApi
        ? () => apis.companyApi.getCompanyCreditHistory({
          pageSize: Math.max(config.trendPoints, config.rowsLimit, 20),
          currentPage: 1,
        })
        : null,
      'Company API unavailable',
    )
    : Promise.resolve(markSkippedSource(sources, 'companyCreditHistory', 'Finance/charts section disabled'));

  const allPurchaseOrdersPromise = requirements.purchaseOrders
    ? safeRequest(
      sources,
      'purchaseOrdersAll',
      apis.purchaseOrderApi ? () => apis.purchaseOrderApi.getPurchaseOrders({}, 50, 1) : null,
      'Purchase order API unavailable',
    )
    : Promise.resolve(markSkippedSource(sources, 'purchaseOrdersAll', 'Operations/charts section disabled'));

  const myApprovalsPromise = requirements.myApprovals
    ? safeRequest(
      sources,
      'purchaseOrdersMyApprovals',
      apis.purchaseOrderApi
        ? () => apis.purchaseOrderApi.getPurchaseOrders({ myApprovals: true }, 50, 1)
        : null,
      'Purchase order API unavailable',
    )
    : Promise.resolve(markSkippedSource(sources, 'purchaseOrdersMyApprovals', 'Operations section disabled'));

  const companyPurchaseOrdersPromise = requirements.companyPurchaseOrders
    ? safeRequest(
      sources,
      'purchaseOrdersCompany',
      apis.purchaseOrderApi
        ? () => apis.purchaseOrderApi.getPurchaseOrders({ companyPurchaseOrders: true }, 50, 1)
        : null,
      'Purchase order API unavailable',
    )
    : Promise.resolve(markSkippedSource(sources, 'purchaseOrdersCompany', 'Operations/charts section disabled'));

  const cartPromise = requirements.cart
    ? safeRequest(
      sources,
      'cartData',
      apis.cartApi ? () => apis.cartApi.getCartData() : null,
      'Cart API unavailable',
    )
    : Promise.resolve(markSkippedSource(sources, 'cartData', 'Sourcing section disabled'));

  const companyUsersPromise = requirements.companyUsers
    ? safeRequest(
      sources,
      'companyUsers',
      apis.companyApi
        ? () => apis.companyApi.getCompanyUsers({ pageSize: 100, currentPage: 1 })
        : null,
      'Company API unavailable',
    )
    : Promise.resolve(markSkippedSource(sources, 'companyUsers', 'Operations/charts section disabled'));

  const negotiableQuotesPromise = requirements.negotiableQuotes
    ? safeRequest(
      sources,
      'negotiableQuotes',
      apis.quoteApi ? () => apis.quoteApi.negotiableQuotes({ pageSize: 50, currentPage: 1 }) : null,
      'Quote API unavailable',
    )
    : Promise.resolve(markSkippedSource(sources, 'negotiableQuotes', 'Sourcing/charts section disabled'));

  const quoteTemplatesPromise = requirements.quoteTemplates
    ? safeRequest(
      sources,
      'quoteTemplates',
      apis.quoteApi
        ? () => apis.quoteApi.getQuoteTemplates({ pageSize: 50, currentPage: 1 })
        : null,
      'Quote API unavailable',
    )
    : Promise.resolve(markSkippedSource(sources, 'quoteTemplates', 'Sourcing section disabled'));

  const requisitionListsPromise = requirements.requisitionLists
    ? safeRequest(
      sources,
      'requisitionLists',
      apis.requisitionApi ? () => apis.requisitionApi.getRequisitionLists(1, 50) : null,
      'Requisition list API unavailable',
    )
    : Promise.resolve(markSkippedSource(sources, 'requisitionLists', 'Sourcing section disabled'));

  const wishlistsPromise = requirements.wishlists
    ? safeRequest(
      sources,
      'wishlists',
      apis.wishlistApi ? () => apis.wishlistApi.getWishlists() : null,
      'Wishlist API unavailable',
    )
    : Promise.resolve(markSkippedSource(sources, 'wishlists', 'Sourcing section disabled'));

  const [
    orderHistory,
    companyCredit,
    companyCreditHistory,
    allPurchaseOrders,
    myApprovals,
    companyPurchaseOrders,
    cart,
    companyUsers,
    negotiableQuotes,
    quoteTemplates,
    requisitionLists,
    wishlists,
  ] = await Promise.all([
    orderHistoryPromise,
    companyCreditPromise,
    companyCreditHistoryPromise,
    allPurchaseOrdersPromise,
    myApprovalsPromise,
    companyPurchaseOrdersPromise,
    cartPromise,
    companyUsersPromise,
    negotiableQuotesPromise,
    quoteTemplatesPromise,
    requisitionListsPromise,
    wishlistsPromise,
  ]);

  return {
    orderHistory,
    companyCredit,
    companyCreditHistory,
    allPurchaseOrders,
    myApprovals,
    companyPurchaseOrders,
    cart,
    companyUsers,
    negotiableQuotes,
    quoteTemplates,
    requisitionLists,
    wishlists,
  };
}

/**
 * Get latest money object list and determine whether aggregate is safe.
 * @param {Array<any>} collection
 * @param {Function} moneyGetter
 * @returns {{
 *  state: 'none'|'mixed'|'single',
 *  values: number[],
 *  total: number,
 *  average: number,
 *  currency?: string
 * }}
 */
function aggregateMoney(collection, moneyGetter) {
  const entries = Array.isArray(collection) ? collection : [];
  const valid = entries
    .map((item) => moneyGetter(item))
    .filter((money) => money && typeof money.value === 'number' && Number.isFinite(money.value) && money.currency);

  if (valid.length === 0) {
    return {
      state: 'none',
      values: [],
      total: 0,
      average: 0,
    };
  }

  const currencies = [...new Set(valid.map((money) => money.currency))];
  if (currencies.length > 1) {
    return {
      state: 'mixed',
      values: valid.map((money) => money.value),
      total: 0,
      average: 0,
    };
  }

  const values = valid.map((money) => money.value);
  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    state: 'single',
    values,
    total,
    average: total / values.length,
    currency: currencies[0],
  };
}

/**
 * Format aggregate money result.
 * @param {{ state: string, total: number, average: number, currency?: string }} aggregate
 * @param {'total'|'average'} mode
 * @returns {{ value: string, isFallback: boolean, isMixed?: boolean }}
 */
function formatAggregateMoney(aggregate, mode = 'total') {
  if (!aggregate || aggregate.state === 'none') {
    return { value: FALLBACK_TEXT, isFallback: true };
  }

  if (aggregate.state === 'mixed') {
    return { value: MIXED_CURRENCY_TEXT, isFallback: true, isMixed: true };
  }

  const value = mode === 'average' ? aggregate.average : aggregate.total;
  return { value: formatMoney(value, aggregate.currency), isFallback: false };
}

/**
 * Create a metric descriptor.
 * @param {string} id
 * @param {string} group
 * @param {string} label
 * @param {string} value
 * @param {boolean} isFallback
 * @param {string} [note]
 * @returns {object}
 */
function createMetric(id, group, label, value, isFallback, note = '') {
  return {
    id,
    group,
    label,
    value,
    isFallback,
    note,
  };
}

/**
 * Get a color from the chart palette.
 * @param {number} index
 * @returns {string}
 */
export function getChartColor(index) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/**
 * Build ordered trend points from order history.
 * @param {object | null} orderHistory
 * @param {number} trendPoints
 * @returns {Array<{label: string, date: string, value: number, currency: string}>}
 */
function buildOrderTrendPoints(orderHistory, trendPoints) {
  const items = Array.isArray(orderHistory?.items) ? orderHistory.items : [];

  const points = items
    .map((item) => {
      const money = item?.total?.grandTotal;
      const date = parseDate(item?.orderDate);
      if (!money || typeof money.value !== 'number' || !money.currency || !date) return null;
      return {
        label: formatDate(date),
        date: date.toISOString(),
        value: money.value,
        currency: money.currency,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return points.slice(-trendPoints);
}

/**
 * Return statuses count map for records.
 * @param {Array<any>} items
 * @param {Function} getter
 * @returns {Array<{label: string, raw: string, value: number}>}
 */
function buildStatusCounts(items, getter) {
  const map = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const raw = getter(item);
    if (!raw) return;
    const key = String(raw).trim();
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });

  return [...map.entries()]
    .map(([raw, value]) => ({
      raw,
      value,
      label: formatStatus(raw),
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Create chart model for line trend.
 * @param {string} id
 * @param {string} title
 * @param {string} description
 * @param {Array<{label: string, value: number, currency: string}>} points
 * @returns {object}
 */
function createLineChart(id, title, description, points) {
  if (!Array.isArray(points) || points.length < 2) {
    return {
      id,
      title,
      description,
      type: 'line',
      state: 'empty',
      emptyText: 'Not enough data points yet.',
    };
  }

  const currencies = [...new Set(points.map((point) => point.currency))];
  if (currencies.length > 1) {
    return {
      id,
      title,
      description,
      type: 'line',
      state: 'mixed',
      emptyText: MIXED_CURRENCY_TEXT,
    };
  }

  return {
    id,
    title,
    description,
    type: 'line',
    state: 'ready',
    points,
    currency: currencies[0],
  };
}

/**
 * Create chart model for status bars.
 * @param {string} id
 * @param {string} title
 * @param {string} description
 * @param {Array<{label: string, value: number, raw: string}>} entries
 * @param {'bar'|'stacked'} variant
 * @returns {object}
 */
function createStatusChart(id, title, description, entries, variant = 'bar') {
  const filtered = (Array.isArray(entries) ? entries : []).filter((entry) => entry.value > 0);
  if (filtered.length === 0) {
    return {
      id,
      title,
      description,
      type: variant,
      state: 'empty',
      emptyText: 'No status data available.',
    };
  }

  return {
    id,
    title,
    description,
    type: variant,
    state: 'ready',
    entries: filtered,
    total: filtered.reduce((sum, entry) => sum + entry.value, 0),
  };
}

/**
 * Create chart model for team split donut.
 * @param {number} active
 * @param {number} inactive
 * @returns {object}
 */
function createTeamChart(active, inactive) {
  const total = (active || 0) + (inactive || 0);
  if (!total) {
    return {
      id: 'team-status-split',
      title: 'Team Status Split',
      description: 'Active vs inactive company users',
      type: 'donut',
      state: 'empty',
      emptyText: 'No team members found.',
    };
  }

  return {
    id: 'team-status-split',
    title: 'Team Status Split',
    description: 'Active vs inactive company users',
    type: 'donut',
    state: 'ready',
    total,
    entries: [
      { label: 'Active', value: active || 0 },
      { label: 'Inactive', value: inactive || 0 },
    ],
  };
}

/**
 * Build a compact sparkline from line points.
 * @param {Array<{value:number}>} points
 * @returns {SVGElement | null}
 */
export function buildSparkline(points) {
  if (!Array.isArray(points) || points.length < 2) return null;

  const width = 320;
  const height = 76;
  const topPadding = 12;
  const bottomPadding = 12;
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
  svg.classList.add('live-block-sparkline-svg');

  const gradientId = `live-block-grad-${Math.random().toString(36).slice(2, 10)}`;
  const defs = document.createElementNS(ns, 'defs');
  const gradient = document.createElementNS(ns, 'linearGradient');
  gradient.setAttribute('id', gradientId);
  gradient.setAttribute('x1', '0');
  gradient.setAttribute('y1', '0');
  gradient.setAttribute('x2', '0');
  gradient.setAttribute('y2', '1');

  const stopA = document.createElementNS(ns, 'stop');
  stopA.setAttribute('offset', '0%');
  stopA.setAttribute('stop-color', '#34d399');
  stopA.setAttribute('stop-opacity', '0.35');

  const stopB = document.createElementNS(ns, 'stop');
  stopB.setAttribute('offset', '100%');
  stopB.setAttribute('stop-color', '#34d399');
  stopB.setAttribute('stop-opacity', '0');

  gradient.append(stopA, stopB);
  defs.append(gradient);

  const area = document.createElementNS(ns, 'path');
  area.setAttribute('d', areaPath);
  area.setAttribute('fill', `url(#${gradientId})`);

  const line = document.createElementNS(ns, 'path');
  line.setAttribute('d', linePath);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#34d399');
  line.setAttribute('stroke-width', '2.5');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');

  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('cx', String(lastX));
  dot.setAttribute('cy', String(lastY));
  dot.setAttribute('r', '3.8');
  dot.setAttribute('fill', '#34d399');

  svg.append(defs, area, line, dot);
  return svg;
}

/**
 * Generate line chart SVG markup.
 * @param {object} chart
 * @returns {string}
 */
function renderLineChartMarkup(chart) {
  const width = 440;
  const height = 230;
  const padLeft = 44;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 42;

  const values = chart.points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const graphWidth = width - padLeft - padRight;
  const graphHeight = height - padTop - padBottom;
  const stepX = graphWidth / Math.max(chart.points.length - 1, 1);

  const coords = chart.points.map((point, index) => {
    const x = padLeft + (index * stepX);
    const y = padTop + (graphHeight - (((point.value - min) / range) * graphHeight));
    return {
      ...point,
      x,
      y,
    };
  });

  const linePath = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const areaPath = `${linePath} L${(padLeft + graphWidth).toFixed(2)} ${(padTop + graphHeight).toFixed(2)} L${padLeft} ${(padTop + graphHeight).toFixed(2)} Z`;

  const circleMarkup = coords.map((point) => `
    <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3.5" fill="#34d399">
      <title>${escapeHtml(`${point.label}: ${formatMoney(point.value, chart.currency)}`)}</title>
    </circle>
  `).join('');

  const xTickIndexes = [0, Math.floor((coords.length - 1) / 2), coords.length - 1]
    .filter((index, position, arr) => arr.indexOf(index) === position);

  const xTicks = xTickIndexes.map((index) => {
    const point = coords[index];
    return `<text x="${point.x.toFixed(2)}" y="${(height - 16).toFixed(2)}" text-anchor="middle" class="live-block-chart-axis">${escapeHtml(point.label)}</text>`;
  }).join('');

  return `
    <div class="live-block-chart-svg-wrap">
      <svg class="live-block-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${chart.id}-title ${chart.id}-desc">
        <title id="${chart.id}-title">${escapeHtml(chart.title)}</title>
        <desc id="${chart.id}-desc">${escapeHtml(chart.description)}</desc>

        <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + graphHeight}" class="live-block-chart-grid-line" />
        <line x1="${padLeft}" y1="${padTop + graphHeight}" x2="${padLeft + graphWidth}" y2="${padTop + graphHeight}" class="live-block-chart-grid-line" />

        <text x="8" y="${(padTop + 8).toFixed(2)}" class="live-block-chart-axis">${escapeHtml(formatMoney(max, chart.currency))}</text>
        <text x="8" y="${(padTop + graphHeight).toFixed(2)}" class="live-block-chart-axis">${escapeHtml(formatMoney(min, chart.currency))}</text>

        <path d="${areaPath}" fill="url(#${chart.id}-area)" />
        <defs>
          <linearGradient id="${chart.id}-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#34d399" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#34d399" stop-opacity="0.04" />
          </linearGradient>
        </defs>

        <path d="${linePath}" class="live-block-chart-line" />
        ${circleMarkup}
        ${xTicks}
      </svg>
      <ul class="live-block-legend">
        <li>
          <span class="live-block-legend-dot" style="--live-legend-color:#34d399"></span>
          <span>Order total (${escapeHtml(chart.currency)})</span>
        </li>
      </ul>
    </div>
  `;
}

/**
 * Generate vertical bar chart SVG markup.
 * @param {object} chart
 * @returns {string}
 */
function renderBarChartMarkup(chart) {
  const width = 440;
  const height = 230;
  const padLeft = 42;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 52;

  const entries = chart.entries.slice(0, 8);
  const max = Math.max(...entries.map((entry) => entry.value));
  const graphWidth = width - padLeft - padRight;
  const graphHeight = height - padTop - padBottom;
  const barSlot = graphWidth / entries.length;
  const barWidth = Math.max(16, barSlot * 0.58);

  const bars = entries.map((entry, index) => {
    const ratio = entry.value / Math.max(max, 1);
    const h = Math.max(4, ratio * graphHeight);
    const x = padLeft + (index * barSlot) + ((barSlot - barWidth) / 2);
    const y = padTop + (graphHeight - h);
    const color = getChartColor(index);

    return `
      <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${h.toFixed(2)}" rx="5" fill="${color}">
        <title>${escapeHtml(`${entry.label}: ${entry.value}`)}</title>
      </rect>
      <text x="${(x + (barWidth / 2)).toFixed(2)}" y="${(padTop + graphHeight + 16).toFixed(2)}" text-anchor="middle" class="live-block-chart-axis">
        ${escapeHtml(entry.label.length > 10 ? `${entry.label.slice(0, 10)}…` : entry.label)}
      </text>
    `;
  }).join('');

  const legend = entries.map((entry, index) => `
    <li>
      <span class="live-block-legend-dot" style="--live-legend-color:${getChartColor(index)}"></span>
      <span>${escapeHtml(entry.label)}: ${escapeHtml(formatCount(entry.value))}</span>
    </li>
  `).join('');

  return `
    <div class="live-block-chart-svg-wrap">
      <svg class="live-block-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${chart.id}-title ${chart.id}-desc">
        <title id="${chart.id}-title">${escapeHtml(chart.title)}</title>
        <desc id="${chart.id}-desc">${escapeHtml(chart.description)}</desc>

        <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + graphHeight}" class="live-block-chart-grid-line" />
        <line x1="${padLeft}" y1="${padTop + graphHeight}" x2="${padLeft + graphWidth}" y2="${padTop + graphHeight}" class="live-block-chart-grid-line" />

        <text x="8" y="${(padTop + 8).toFixed(2)}" class="live-block-chart-axis">${escapeHtml(formatCount(max))}</text>
        <text x="8" y="${(padTop + graphHeight).toFixed(2)}" class="live-block-chart-axis">0</text>

        ${bars}
      </svg>

      <ul class="live-block-legend">
        ${legend}
      </ul>
    </div>
  `;
}

/**
 * Generate donut chart SVG markup.
 * @param {object} chart
 * @returns {string}
 */
function renderDonutChartMarkup(chart) {
  const width = 440;
  const height = 230;
  const cx = 145;
  const cy = 112;
  const radius = 62;
  const strokeWidth = 26;

  let offset = 0;
  const circumference = 2 * Math.PI * radius;

  const segments = chart.entries.map((entry, index) => {
    const value = Math.max(entry.value, 0);
    const ratio = chart.total ? value / chart.total : 0;
    const length = ratio * circumference;
    const color = getChartColor(index);
    const segment = `
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${length.toFixed(2)} ${(circumference - length).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})">
        <title>${escapeHtml(`${entry.label}: ${entry.value}`)}</title>
      </circle>
    `;
    offset += length;
    return segment;
  }).join('');

  const legend = chart.entries.map((entry, index) => `
    <li>
      <span class="live-block-legend-dot" style="--live-legend-color:${getChartColor(index)}"></span>
      <span>${escapeHtml(entry.label)}: ${escapeHtml(formatCount(entry.value))}</span>
    </li>
  `).join('');

  return `
    <div class="live-block-chart-svg-wrap">
      <svg class="live-block-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${chart.id}-title ${chart.id}-desc">
        <title id="${chart.id}-title">${escapeHtml(chart.title)}</title>
        <desc id="${chart.id}-desc">${escapeHtml(chart.description)}</desc>

        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="rgb(148 163 184 / 25%)" stroke-width="${strokeWidth}" />
        ${segments}

        <text x="${cx}" y="${cy - 2}" text-anchor="middle" class="live-block-chart-center-label">${escapeHtml(formatCount(chart.total))}</text>
        <text x="${cx}" y="${cy + 18}" text-anchor="middle" class="live-block-chart-axis">Users</text>
      </svg>

      <ul class="live-block-legend">
        ${legend}
      </ul>
    </div>
  `;
}

/**
 * Generate stacked status bar chart SVG markup.
 * @param {object} chart
 * @returns {string}
 */
function renderStackedBarChartMarkup(chart) {
  const width = 440;
  const height = 190;
  const x = 18;
  const y = 58;
  const barWidth = 400;
  const barHeight = 34;
  const total = Math.max(chart.total, 1);

  let cursor = x;

  const segments = chart.entries.map((entry, index) => {
    const segmentWidth = Math.max(6, (entry.value / total) * barWidth);
    const color = getChartColor(index);
    const rect = `
      <rect x="${cursor.toFixed(2)}" y="${y}" width="${segmentWidth.toFixed(2)}" height="${barHeight}" rx="4" fill="${color}">
        <title>${escapeHtml(`${entry.label}: ${entry.value}`)}</title>
      </rect>
    `;
    cursor += segmentWidth;
    return rect;
  }).join('');

  const legend = chart.entries.map((entry, index) => {
    const pct = chart.total ? ((entry.value / chart.total) * 100) : 0;
    return `
      <li>
        <span class="live-block-legend-dot" style="--live-legend-color:${getChartColor(index)}"></span>
        <span>${escapeHtml(entry.label)}: ${escapeHtml(formatCount(entry.value))} (${pct.toFixed(0)}%)</span>
      </li>
    `;
  }).join('');

  return `
    <div class="live-block-chart-svg-wrap">
      <svg class="live-block-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${chart.id}-title ${chart.id}-desc">
        <title id="${chart.id}-title">${escapeHtml(chart.title)}</title>
        <desc id="${chart.id}-desc">${escapeHtml(chart.description)}</desc>

        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="rgb(15 23 42 / 42%)" />
        ${segments}
        <text x="${x}" y="${y - 14}" class="live-block-chart-axis">0</text>
        <text x="${x + barWidth}" y="${y - 14}" text-anchor="end" class="live-block-chart-axis">${escapeHtml(formatCount(chart.total))}</text>
      </svg>

      <ul class="live-block-legend">
        ${legend}
      </ul>
    </div>
  `;
}

/**
 * Render chart markup with fallback handling.
 * @param {object} chart
 * @returns {string}
 */
export function renderChartMarkup(chart) {
  if (chart.state !== 'ready') {
    return `<p class="live-block-chart-empty" role="status">${escapeHtml(chart.emptyText || FALLBACK_TEXT)}</p>`;
  }

  if (chart.type === 'line') return renderLineChartMarkup(chart);
  if (chart.type === 'bar') return renderBarChartMarkup(chart);
  if (chart.type === 'donut') return renderDonutChartMarkup(chart);
  if (chart.type === 'stacked') return renderStackedBarChartMarkup(chart);

  return `<p class="live-block-chart-empty" role="status">${escapeHtml(FALLBACK_TEXT)}</p>`;
}

/**
 * Build the data view-model for rendering.
 * @param {object} config
 * @param {object} requirements
 * @param {object} data
 * @param {Record<string, any>} sources
 * @returns {object}
 */
export function buildViewModel(config, requirements, data, sources) {
  const now = new Date().toISOString();

  const orderItems = Array.isArray(data.orderHistory?.items) ? data.orderHistory.items : [];
  const orderWindowThreshold = Date.now() - (config.orderWindowDays * 24 * 60 * 60 * 1000);
  const orderItemsInWindow = orderItems.filter((item) => {
    const date = parseDate(item?.orderDate);
    return date && date.getTime() >= orderWindowThreshold;
  });

  const orderWindowMoney = aggregateMoney(orderItemsInWindow, (item) => item?.total?.grandTotal);
  const windowSpend = formatAggregateMoney(orderWindowMoney, 'total');
  const windowAov = formatAggregateMoney(orderWindowMoney, 'average');

  const companyPoItems = Array.isArray(data.companyPurchaseOrders?.purchaseOrderItems)
    ? data.companyPurchaseOrders.purchaseOrderItems
    : [];
  const fallbackPoItems = Array.isArray(data.allPurchaseOrders?.purchaseOrderItems)
    ? data.allPurchaseOrders.purchaseOrderItems
    : [];
  const poItems = companyPoItems.length ? companyPoItems : fallbackPoItems;
  const poMoney = aggregateMoney(poItems, (item) => item?.quote?.grandTotal);
  const poPipeline = formatAggregateMoney(poMoney, 'total');

  const credit = data.companyCredit?.credit;
  const availableCredit = credit?.available_credit;
  const creditLimit = credit?.credit_limit;
  const outstandingBalance = credit?.outstanding_balance;

  const utilization = (
    typeof creditLimit?.value === 'number'
    && creditLimit.value > 0
    && typeof outstandingBalance?.value === 'number'
  )
    ? (outstandingBalance.value / creditLimit.value) * 100
    : undefined;

  const users = Array.isArray(data.companyUsers?.users) ? data.companyUsers.users : [];
  const activeUsers = users.filter((user) => user?.status === 'ACTIVE').length;
  const inactiveUsers = users.filter((user) => user?.status === 'INACTIVE').length;

  const quotes = Array.isArray(data.negotiableQuotes?.items) ? data.negotiableQuotes.items : [];
  const openQuotes = quotes.filter((quote) => !TERMINAL_QUOTE_STATUSES.has(String(quote?.status || '').toUpperCase())).length;

  const requisitionLists = Array.isArray(data.requisitionLists) ? data.requisitionLists : [];
  const wishlists = Array.isArray(data.wishlists) ? data.wishlists : [];
  const wishlistItemsCount = wishlists.reduce((sum, wishlist) => {
    const count = wishlist?.items_count;
    return sum + (typeof count === 'number' ? count : 0);
  }, 0);

  const quoteTemplatesCount = typeof data.quoteTemplates?.totalCount === 'number'
    ? data.quoteTemplates.totalCount
    : undefined;

  const orderTrendPoints = buildOrderTrendPoints(data.orderHistory, config.trendPoints);

  const creditHistoryItems = Array.isArray(data.companyCreditHistory?.items)
    ? data.companyCreditHistory.items
    : [];

  const creditTrendPoints = creditHistoryItems
    .map((item) => {
      const date = parseDate(item?.date);
      const available = item?.balance?.availableCredit;
      if (!date || !available || typeof available.value !== 'number' || !available.currency) return null;
      return {
        label: formatDate(date),
        date: date.toISOString(),
        value: available.value,
        currency: available.currency,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-config.trendPoints);

  const poStatusCounts = buildStatusCounts(poItems, (item) => item?.status);
  const quoteStatusCounts = buildStatusCounts(quotes, (item) => item?.status);

  const metricsList = [
    createMetric(
      'creditAvailable',
      'finance',
      'Credit Available',
      formatMoney(availableCredit?.value, availableCredit?.currency),
      !availableCredit || typeof availableCredit.value !== 'number',
    ),
    createMetric(
      'creditLimit',
      'finance',
      'Credit Limit',
      formatMoney(creditLimit?.value, creditLimit?.currency),
      !creditLimit || typeof creditLimit.value !== 'number',
    ),
    createMetric(
      'outstandingBalance',
      'finance',
      'Outstanding Balance',
      formatMoney(outstandingBalance?.value, outstandingBalance?.currency),
      !outstandingBalance || typeof outstandingBalance.value !== 'number',
    ),
    createMetric(
      'creditUtilization',
      'finance',
      'Utilization',
      formatPercent(utilization),
      typeof utilization !== 'number',
    ),

    createMetric(
      'ordersTotal',
      'operations',
      'Total Orders',
      formatCount(data.orderHistory?.totalCount),
      typeof data.orderHistory?.totalCount !== 'number',
    ),
    createMetric(
      'ordersInWindow',
      'operations',
      `Orders (${config.orderWindowDays}d)`,
      formatCount(orderItemsInWindow.length),
      !requirements.orders,
      'Within fetched orders',
    ),
    createMetric(
      'windowSpend',
      'operations',
      `Window Spend (${config.orderWindowDays}d)`,
      windowSpend.value,
      windowSpend.isFallback,
      'Within fetched orders',
    ),
    createMetric(
      'orderAov',
      'operations',
      `AOV (${config.orderWindowDays}d)`,
      windowAov.value,
      windowAov.isFallback,
      'Within fetched orders',
    ),
    createMetric(
      'pendingApprovals',
      'operations',
      'Pending Approvals',
      formatCount(data.myApprovals?.totalCount),
      typeof data.myApprovals?.totalCount !== 'number',
    ),
    createMetric(
      'companyPoCount',
      'operations',
      'Company PO Count',
      formatCount(data.companyPurchaseOrders?.totalCount),
      typeof data.companyPurchaseOrders?.totalCount !== 'number',
    ),
    createMetric(
      'poPipelineValue',
      'operations',
      'PO Pipeline Value',
      poPipeline.value,
      poPipeline.isFallback,
    ),
    createMetric(
      'activeUsers',
      'operations',
      'Active Users',
      formatCount(activeUsers),
      !requirements.companyUsers,
    ),
    createMetric(
      'inactiveUsers',
      'operations',
      'Inactive Users',
      formatCount(inactiveUsers),
      !requirements.companyUsers,
    ),

    createMetric(
      'cartValue',
      'sourcing',
      'Cart Value',
      formatMoney(data.cart?.total?.includingTax?.value, data.cart?.total?.includingTax?.currency),
      !data.cart?.total?.includingTax || typeof data.cart.total.includingTax.value !== 'number',
    ),
    createMetric(
      'cartQuantity',
      'sourcing',
      'Cart Quantity',
      formatCount(data.cart?.totalQuantity),
      typeof data.cart?.totalQuantity !== 'number',
    ),
    createMetric(
      'openQuotes',
      'sourcing',
      'Open Quotes',
      formatCount(openQuotes),
      !requirements.negotiableQuotes,
    ),
    createMetric(
      'quoteCount',
      'sourcing',
      'Quote Count',
      formatCount(data.negotiableQuotes?.totalCount),
      typeof data.negotiableQuotes?.totalCount !== 'number',
    ),
    createMetric(
      'quoteTemplates',
      'sourcing',
      'Quote Templates',
      formatCount(quoteTemplatesCount),
      typeof quoteTemplatesCount !== 'number',
    ),
    createMetric(
      'requisitionListCount',
      'sourcing',
      'Requisition Lists',
      formatCount(requisitionLists.length),
      !requirements.requisitionLists,
    ),
    createMetric(
      'wishlistItems',
      'sourcing',
      'Wishlist Items',
      formatCount(wishlistItemsCount),
      !requirements.wishlists,
    ),
  ];

  const metrics = Object.fromEntries(metricsList.map((metric) => [metric.id, metric]));

  const charts = [
    createLineChart(
      'order-value-trend',
      'Order Value Trend',
      `Recent order totals (${config.trendPoints} points max)`,
      orderTrendPoints,
    ),
    createStatusChart(
      'po-status-breakdown',
      'PO Status Breakdown',
      'Distribution of company purchase orders by status',
      poStatusCounts,
      'bar',
    ),
    createLineChart(
      'credit-timeline',
      'Credit Timeline',
      'Available company credit over recent transactions',
      creditTrendPoints,
    ),
    createTeamChart(activeUsers, inactiveUsers),
    createStatusChart(
      'quote-pipeline',
      'Quote Pipeline',
      'Stacked distribution of quote statuses',
      quoteStatusCounts,
      'stacked',
    ),
  ];

  const activities = {
    purchaseOrders: poItems
      .slice(0, config.rowsLimit)
      .map((item) => ({
        id: item?.uid || item?.number || '',
        title: item?.number ? `PO #${item.number}` : 'Purchase Order',
        subtitle: formatStatus(item?.status),
        amount: formatMoney(item?.quote?.grandTotal?.value, item?.quote?.grandTotal?.currency),
        date: formatDate(item?.createdAt),
      })),
    creditHistory: creditHistoryItems
      .slice(0, config.rowsLimit)
      .map((item) => ({
        id: `${item?.date || ''}-${item?.type || ''}`,
        title: formatStatus(item?.type),
        subtitle: item?.updatedBy?.name || FALLBACK_TEXT,
        amount: formatMoney(item?.amount?.value, item?.amount?.currency),
        date: formatDate(item?.date),
      })),
    quotes: quotes
      .slice(0, config.rowsLimit)
      .map((item) => ({
        id: item?.uid || item?.name || '',
        title: item?.name || 'Negotiable Quote',
        subtitle: formatStatus(item?.status),
        amount: formatMoney(item?.prices?.grandTotal?.value, item?.prices?.grandTotal?.currency),
        date: formatDate(item?.updatedAt || item?.createdAt),
      })),
  };

  const sparklinePoints = orderTrendPoints;

  return {
    metrics,
    charts,
    activity: activities,
    sources,
    lastUpdatedAt: now,
    windows: {
      orderWindowDays: config.orderWindowDays,
      trendPoints: config.trendPoints,
    },
    sparklinePoints,
  };
}

/**
 * Build grouped metric list for section rendering.
 * @param {Record<string, any>} metrics
 * @param {'finance'|'operations'|'sourcing'} group
 * @returns {Array<object>}
 */
export function metricsByGroup(metrics, group) {
  return Object.values(metrics).filter((metric) => metric.group === group);
}

/**
 * Build an empty view model when all sections are disabled.
 * @param {object} config
 * @param {Record<string, any>} sources
 * @returns {object}
 */
function buildEmptyViewModel(config, sources = {}) {
  return {
    metrics: {},
    charts: [],
    activity: {
      purchaseOrders: [],
      creditHistory: [],
      quotes: [],
    },
    sources,
    lastUpdatedAt: new Date().toISOString(),
    windows: {
      orderWindowDays: config.orderWindowDays,
      trendPoints: config.trendPoints,
    },
    sparklinePoints: [],
  };
}

/**
 * Shared dashboard lifecycle runner for live dashboard blocks.
 * @param {object} params
 * @param {HTMLElement} params.block
 * @param {object} params.config
 * @param {Function} params.renderGuest
 * @param {Function} params.renderLoading
 * @param {Function} params.renderAuthenticated
 */
export async function runDashboardLifecycle({
  block,
  config,
  renderGuest,
  renderLoading,
  renderAuthenticated,
}) {
  const requirements = getRequirements(config);

  let refreshToken = 0;
  let refreshTimeout = null;
  let isDisposed = false;

  const subscriptions = [];

  const refresh = async (reason = 'event') => {
    const currentToken = refreshToken + 1;
    refreshToken = currentToken;

    if (!checkIsAuthenticated()) {
      renderGuest(block, config);
      return;
    }

    renderLoading(
      block,
      config.title,
      reason === 'manual'
        ? 'Refreshing live commerce data...'
        : 'Loading live commerce data...',
    );

    const sources = {};

    if (!requirements.hasActiveSection) {
      renderAuthenticated(
        block,
        config,
        buildEmptyViewModel(config, sources),
        () => scheduleRefresh('manual'),
      );
      return;
    }

    await initializeRequiredDropins(requirements);
    const apis = await loadRequiredApis(requirements);

    if (refreshToken !== currentToken || isDisposed) return;
    if (!checkIsAuthenticated()) {
      renderGuest(block, config);
      return;
    }

    const data = await fetchDashboardData(requirements, apis, config, sources);

    if (refreshToken !== currentToken || isDisposed) return;

    const viewModel = buildViewModel(config, requirements, data, sources);
    renderAuthenticated(
      block,
      config,
      viewModel,
      () => scheduleRefresh('manual'),
    );
  };

  function scheduleRefresh(reason = 'event') {
    if (refreshTimeout) {
      window.clearTimeout(refreshTimeout);
    }

    const delay = reason === 'manual' ? 0 : 120;
    refreshTimeout = window.setTimeout(() => {
      refresh(reason);
    }, delay);
  }

  await refresh('load');

  subscriptions.push(events.on('authenticated', () => {
    scheduleRefresh('authenticated');
  }));

  subscriptions.push(events.on('purchase-order/refresh', () => {
    if (checkIsAuthenticated()) {
      scheduleRefresh('purchase-order/refresh');
    }
  }));

  if (config.showSourcingSection) {
    subscriptions.push(events.on('cart/data', () => {
      if (checkIsAuthenticated()) {
        scheduleRefresh('cart/data');
      }
    }));

    subscriptions.push(events.on('quote-management/negotiable-quote-requested', () => {
      if (checkIsAuthenticated()) {
        scheduleRefresh('quote-management/negotiable-quote-requested');
      }
    }));

    subscriptions.push(events.on('quote-management/quote-duplicated', () => {
      if (checkIsAuthenticated()) {
        scheduleRefresh('quote-management/quote-duplicated');
      }
    }));

    subscriptions.push(events.on('quote-management/quote-template-generated', () => {
      if (checkIsAuthenticated()) {
        scheduleRefresh('quote-management/quote-template-generated');
      }
    }));

    subscriptions.push(events.on('wishlist/alert', () => {
      if (checkIsAuthenticated()) {
        scheduleRefresh('wishlist/alert');
      }
    }));
  }

  block.addEventListener('DOMNodeRemoved', () => {
    isDisposed = true;
    if (refreshTimeout) {
      window.clearTimeout(refreshTimeout);
    }

    subscriptions.forEach((subscription) => {
      subscription?.off?.();
    });
  }, { once: true });
}
