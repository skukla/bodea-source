import { events } from '@dropins/tools/event-bus.js';
import { toClassName } from '../../scripts/aem.js';
import {
  checkIsAuthenticated,
  CUSTOMER_ACCOUNT_PATH,
  CUSTOMER_ADDRESS_PATH,
  CUSTOMER_LOGIN_PATH,
  CUSTOMER_NEGOTIABLE_QUOTE_PATH,
  CUSTOMER_ORDERS_PATH,
  CUSTOMER_PO_DETAILS_PATH,
  CUSTOMER_PO_LIST_PATH,
  CUSTOMER_REQUISITION_LISTS_PATH,
  getProductLink,
  rootLink,
} from '../../scripts/commerce.js';
import {
  buildViewModel,
  FALLBACK_TEXT,
  fetchDashboardData,
  formatDateTime,
  getRequirements,
  initializeRequiredDropins,
  loadRequiredApis,
  renderChartMarkup,
} from '../live-block/dashboard-core.js';

const CUSTOMER_COMPANY_PROFILE_PATH = '/customer/company';
const CUSTOMER_COMPANY_CREDIT_PATH = '/customer/company/credit';

const DEFAULTS = {
  eyebrowText: 'Private Member Offers - Q1 2025',
  titleHTML: 'Your <em>exclusive</em> catalog access.',
  subtitle: 'Member-only pricing, first-access inventory, and concierge procurement - built for enterprise IT operations.',
  rowsLimit: 3,
  guestCtaLabel: 'Sign in',
  guestCtaHref: CUSTOMER_LOGIN_PATH,
};

const ANALYTICS_DEFAULTS = {
  orderWindowDays: 90,
  trendPoints: 12,
  showFinanceSection: true,
  showOperationsSection: true,
  showSourcingSection: true,
  showCharts: true,
  showSparkline: false,
  showLastUpdated: true,
  refreshLabel: 'Refresh data',
};

const QUOTE_PERMISSION_KEYS = [
  'Magento_NegotiableQuote::all',
  'Magento_NegotiableQuote::view_quotes',
  'Magento_NegotiableQuote::manage',
];

const COMPANY_PERMISSION_KEYS = [
  'Magento_Company::view',
];

const REQUISITION_PERMISSION_KEYS = [
  'Magento_RequisitionList::requisition_list',
  'Magento_RequisitionList::view',
];

const PO_ALL_KEY = 'Magento_PurchaseOrder::all';
const PO_VIEW_CUSTOMER_KEY = 'Magento_PurchaseOrder::view_purchase_orders';
const PO_VIEW_COMPANY_KEY = 'Magento_PurchaseOrder::view_purchase_orders_for_company';

const TERMINAL_QUOTE_STATUSES = new Set([
  'ORDERED',
  'CLOSED',
  'DECLINED',
  'EXPIRED',
  'INACTIVE',
  'CANCELED',
]);

let dependenciesPromise;

function el(tag, cls = '', attrs = {}, children = []) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;

  Object.entries(attrs).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    node.setAttribute(key, value);
  });

  children.forEach((child) => {
    if (child) node.append(child);
  });

  return node;
}

function text(value) {
  return document.createTextNode(String(value ?? ''));
}

function markup(markupString) {
  const template = document.createElement('template');
  template.innerHTML = markupString.trim();
  return template.content;
}

function clampRowsLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return DEFAULTS.rowsLimit;
  return Math.max(1, Math.min(5, parsed));
}

function buildAnalyticsConfig(rowsLimit) {
  return {
    rowsLimit,
    ...ANALYTICS_DEFAULTS,
  };
}

function normalizeRichTextHTML(html) {
  if (!html) return '';

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();

  if (
    wrapper.childElementCount === 1
    && wrapper.firstElementChild?.tagName === 'P'
  ) {
    return wrapper.firstElementChild.innerHTML.trim();
  }

  return wrapper.innerHTML.trim();
}

function readAuthorConfig(block) {
  const rows = {};

  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = [...row.children];
    if (!keyCell || !valueCell) return;
    rows[toClassName(keyCell.textContent)] = {
      text: valueCell.textContent.trim(),
      html: valueCell.innerHTML.trim(),
    };
  });

  return {
    eyebrowText: rows['eyebrow-text']?.text || DEFAULTS.eyebrowText,
    titleHTML: normalizeRichTextHTML(rows.title?.html) || DEFAULTS.titleHTML,
    subtitle: rows.subtitle?.text || DEFAULTS.subtitle,
    rowsLimit: clampRowsLimit(rows['rows-limit']?.text),
    guestCtaLabel: rows['guest-cta-label']?.text || DEFAULTS.guestCtaLabel,
    guestCtaHref: rows['guest-cta-href']?.text || DEFAULTS.guestCtaHref,
  };
}

function resolveHref(href) {
  if (!href) return rootLink(CUSTOMER_ACCOUNT_PATH);
  if (href.startsWith('/')) return rootLink(href);
  return href;
}

function formatMoney(amount, currency) {
  if (typeof amount !== 'number' || Number.isNaN(amount) || !currency) return '';
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

function formatCount(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return value.toLocaleString('en-US');
}

function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

function formatStatus(status) {
  if (!status) return '';
  return String(status)
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getCustomerName(customer) {
  if (!customer || typeof customer !== 'object') return 'Customer';

  const firstName = customer.firstName || customer.firstname || '';
  const lastName = customer.lastName || customer.lastname || '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || 'Customer';
}

function joinParts(parts) {
  return parts.filter(Boolean).join(' · ');
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isExplicitlyDisabled(permissions, keys) {
  return keys.some((key) => permissions[key] === false);
}

function hasPermission(permissions, keys) {
  const safePermissions = permissions && typeof permissions === 'object' ? permissions : {};
  const normalizedKeys = Array.isArray(keys) ? keys : [];

  if (normalizedKeys.length === 0) return true;
  if (isExplicitlyDisabled(safePermissions, normalizedKeys)) return false;
  if (safePermissions.admin || safePermissions.all) return true;

  return normalizedKeys.some((key) => safePermissions[key] === true);
}

function getPermissionsSnapshot() {
  const snapshot = events.lastPayload('auth/permissions');
  return snapshot && typeof snapshot === 'object' ? snapshot : {};
}

async function safeRequest(label, requestFn) {
  if (typeof requestFn !== 'function') return null;

  try {
    return await requestFn();
  } catch (error) {
    console.warn(`vip-member-block-real-v2: ${label} failed`, error);
    return null;
  }
}

async function loadDependencies(requirements) {
  if (!dependenciesPromise) {
    dependenciesPromise = (async () => {
      await import('../../scripts/initializers/auth.js');
      await initializeRequiredDropins(requirements);
      return loadRequiredApis(requirements);
    })();
  }

  return dependenciesPromise;
}

function buildPoDetailHref(po) {
  const poRef = po?.uid || po?.number;
  if (!poRef) return resolveHref(CUSTOMER_PO_LIST_PATH);
  return rootLink(`${CUSTOMER_PO_DETAILS_PATH}?poRef=${encodeURIComponent(poRef)}`);
}

function buildProductHref(item, po) {
  const urlKey = item?.product?.urlKey || item?.productUrlKey;
  const sku = item?.product?.sku || item?.productSku;

  if (urlKey && sku) {
    return getProductLink(urlKey, sku);
  }

  return buildPoDetailHref(po);
}

function buildModuleHref(path) {
  return resolveHref(path);
}

function getLineItemsFromPurchaseOrder(po) {
  const items = Array.isArray(po?.quote?.items) ? po.quote.items : [];

  return items.map((item, index) => {
    const quantity = item?.quantityOrdered
      ?? item?.totalQuantity
      ?? item?.quantityShipped
      ?? item?.quantityInvoiced;

    const unitPrice = item?.price || item?.regularPrice || item?.total || null;
    const totalPrice = item?.total || item?.price || null;
    const sku = item?.product?.sku || item?.productSku || '';
    const productName = item?.productName || item?.product?.name || '';
    const href = buildProductHref(item, po);

    return {
      id: item?.id || `${po?.uid || po?.number || 'po'}-${sku || index}`,
      dedupeKey: sku || `${po?.uid || po?.number || 'po'}-${item?.id || index}`,
      href,
      po,
      item,
      sku,
      productName,
      quantity,
      unitPrice,
      totalPrice,
      lineTotalLabel: formatMoney(totalPrice?.value, totalPrice?.currency),
      unitPriceLabel: formatMoney(unitPrice?.value, unitPrice?.currency),
      meta: joinParts([
        sku ? `SKU ${sku}` : '',
        typeof quantity === 'number' ? `Qty ${quantity}` : '',
        formatStatus(po?.status),
      ]),
    };
  });
}

function sortPurchaseOrders(purchaseOrders) {
  return [...purchaseOrders].sort((a, b) => {
    const aDate = parseDate(a?.updatedAt || a?.createdAt);
    const bDate = parseDate(b?.updatedAt || b?.createdAt);
    return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
  });
}

function buildSpotlightItems(purchaseOrders, rowsLimit) {
  const seen = new Set();
  const spotlightItems = [];

  sortPurchaseOrders(purchaseOrders).forEach((po) => {
    getLineItemsFromPurchaseOrder(po).forEach((entry) => {
      if (spotlightItems.length >= rowsLimit) return;
      if (seen.has(entry.dedupeKey)) return;

      seen.add(entry.dedupeKey);
      spotlightItems.push(entry);
    });
  });

  return spotlightItems;
}

function buildFeaturedEntry(purchaseOrders) {
  const sortedOrders = sortPurchaseOrders(purchaseOrders);

  for (let index = 0; index < sortedOrders.length; index += 1) {
    const po = sortedOrders[index];
    const entry = getLineItemsFromPurchaseOrder(po)[0];
    if (entry) return entry;
  }

  return null;
}

function buildModuleLinks(state) {
  const modules = [];
  const poCount = typeof state.purchaseOrders?.totalCount === 'number'
    ? formatCount(state.purchaseOrders.totalCount)
    : '';

  if (state.hasPurchaseOrderAccess) {
    modules.push({
      id: 'purchase-orders',
      title: 'Purchase Orders',
      description: poCount
        ? `${poCount} accessible purchase orders`
        : 'Track purchase orders and detail pages',
      href: buildModuleHref(CUSTOMER_PO_LIST_PATH),
      cta: 'Open Purchase Orders',
    });
  }

  if (state.quoteEnabled) {
    const openQuotesLabel = typeof state.openQuotesCount === 'number'
      ? `${formatCount(state.openQuotesCount)} open negotiable quotes`
      : 'Manage negotiable quotes';

    modules.push({
      id: 'quotes',
      title: 'Quotes',
      description: openQuotesLabel,
      href: buildModuleHref(CUSTOMER_NEGOTIABLE_QUOTE_PATH),
      cta: 'Open Quotes',
    });
  }

  if (state.companyCreditEnabled) {
    const creditLabel = formatMoney(
      state.companyCredit?.credit?.available_credit?.value,
      state.companyCredit?.credit?.available_credit?.currency,
    );

    modules.push({
      id: 'company-credit',
      title: 'Company Credit',
      description: creditLabel
        ? `${creditLabel} available credit`
        : 'Review company credit balance',
      href: buildModuleHref(CUSTOMER_COMPANY_CREDIT_PATH),
      cta: 'View Company Credit',
    });
  }

  if (state.hasCompanyProfileAccess) {
    modules.push({
      id: 'company-profile',
      title: 'Company Profile',
      description: state.company?.name || 'View company account settings',
      href: buildModuleHref(CUSTOMER_COMPANY_PROFILE_PATH),
      cta: 'Open Company Profile',
    });
  }

  if (state.requisitionEnabled) {
    modules.push({
      id: 'requisition-lists',
      title: 'Requisition Lists',
      description: 'Open saved requisition lists',
      href: buildModuleHref(CUSTOMER_REQUISITION_LISTS_PATH),
      cta: 'Open Requisition Lists',
    });
  }

  return modules;
}

function buildProofItems(state) {
  const items = [];
  const companyAdmin = state.company?.companyAdmin;
  const salesRepresentative = state.company?.salesRepresentative;
  const paymentMethods = Array.isArray(state.company?.availablePaymentMethods)
    ? state.company.availablePaymentMethods
    : [];
  const shippingMethods = Array.isArray(state.company?.availableShippingMethods)
    ? state.company.availableShippingMethods
    : [];

  if (companyAdmin) {
    items.push({
      title: 'Company Admin',
      sub: joinParts([
        joinParts([companyAdmin.firstname, companyAdmin.lastname]).trim(),
        companyAdmin.email,
      ]),
    });
  }

  if (salesRepresentative) {
    items.push({
      title: 'Sales Representative',
      sub: joinParts([
        joinParts([salesRepresentative.firstname, salesRepresentative.lastname]).trim(),
        salesRepresentative.email,
      ]),
    });
  }

  if (paymentMethods.length) {
    items.push({
      title: 'Payment Methods',
      sub: paymentMethods.slice(0, 3).map((method) => method.title).filter(Boolean).join(' · '),
    });
  }

  if (shippingMethods.length) {
    items.push({
      title: 'Shipping Methods',
      sub: shippingMethods.slice(0, 3).map((method) => method.title).filter(Boolean).join(' · '),
    });
  }

  return items.slice(0, 3);
}

function buildAccountMetrics(state) {
  const metrics = [];
  const availableCredit = state.companyCredit?.credit?.available_credit;
  const paymentMethodsCount = Array.isArray(state.company?.availablePaymentMethods)
    ? state.company.availablePaymentMethods.length
    : undefined;
  const shippingMethodsCount = Array.isArray(state.company?.availableShippingMethods)
    ? state.company.availableShippingMethods.length
    : undefined;

  if (typeof state.orderHistory?.totalCount === 'number') {
    metrics.push({
      value: formatCount(state.orderHistory.totalCount),
      label: 'Recent Orders',
    });
  }

  if (availableCredit && typeof availableCredit.value === 'number') {
    metrics.push({
      value: formatMoney(availableCredit.value, availableCredit.currency),
      label: 'Available Credit',
    });
  }

  if (typeof paymentMethodsCount === 'number') {
    metrics.push({
      value: formatCount(paymentMethodsCount),
      label: 'Payment Methods',
    });
  }

  if (typeof shippingMethodsCount === 'number') {
    metrics.push({
      value: formatCount(shippingMethodsCount),
      label: 'Shipping Methods',
    });
  }

  if (typeof state.openQuotesCount === 'number') {
    metrics.push({
      value: formatCount(state.openQuotesCount),
      label: 'Open Quotes',
    });
  }

  return metrics.slice(0, 4);
}

function buildAnalyticsRequirements(
  baseRequirements,
  {
    hasPurchaseOrderCompanyAccess,
    hasPurchaseOrderCustomerAccess,
    hasPurchaseOrderAccess,
    hasCompanyProfileAccess,
    companyCreditEnabled,
    quoteEnabled,
    requisitionEnabled,
  },
) {
  return {
    ...baseRequirements,
    purchaseOrders: hasPurchaseOrderCustomerAccess,
    companyPurchaseOrders: hasPurchaseOrderCompanyAccess,
    myApprovals: hasPurchaseOrderAccess,
    companyCredit: companyCreditEnabled,
    companyCreditHistory: companyCreditEnabled,
    companyUsers: hasCompanyProfileAccess,
    negotiableQuotes: quoteEnabled,
    quoteTemplates: quoteEnabled,
    requisitionLists: requisitionEnabled,
  };
}

async function fetchLiveState(rowsLimit) {
  const permissions = getPermissionsSnapshot();
  const analyticsConfig = buildAnalyticsConfig(rowsLimit);
  const baseRequirements = getRequirements(analyticsConfig);
  const apis = await loadDependencies(baseRequirements);
  const {
    accountApi,
    companyApi,
  } = apis;

  const hasPurchaseOrderCompanyAccess = hasPermission(
    permissions,
    [PO_ALL_KEY, PO_VIEW_COMPANY_KEY],
  );
  const hasPurchaseOrderCustomerAccess = hasPermission(
    permissions,
    [PO_ALL_KEY, PO_VIEW_CUSTOMER_KEY],
  );
  const hasPurchaseOrderAccess = hasPurchaseOrderCompanyAccess || hasPurchaseOrderCustomerAccess;
  let purchaseOrderSource = null;
  if (hasPurchaseOrderCompanyAccess) {
    purchaseOrderSource = 'company';
  } else if (hasPurchaseOrderCustomerAccess) {
    purchaseOrderSource = 'customer';
  }
  const quoteEnabled = hasPermission(permissions, QUOTE_PERMISSION_KEYS);
  const requisitionEnabled = hasPermission(permissions, REQUISITION_PERMISSION_KEYS);

  const [customer, companyEnabled] = await Promise.all([
    safeRequest('getCustomer', () => accountApi?.getCustomer()),
    safeRequest('companyEnabled', () => companyApi.companyEnabled()),
  ]);

  const hasCompany = Boolean(companyEnabled);
  const company = hasCompany
    ? await safeRequest('getCompany', () => companyApi.getCompany())
    : null;

  const hasCompanyProfileAccess = Boolean(company)
    && hasPermission(permissions, COMPANY_PERMISSION_KEYS);

  const companyCreditEnabledResponse = company
    ? await safeRequest('checkCompanyCreditEnabled', () => companyApi.checkCompanyCreditEnabled())
    : null;
  const companyCreditEnabled = companyCreditEnabledResponse?.creditEnabled === true;
  const analyticsRequirements = buildAnalyticsRequirements(
    baseRequirements,
    {
      hasPurchaseOrderCompanyAccess,
      hasPurchaseOrderCustomerAccess,
      hasPurchaseOrderAccess,
      hasCompanyProfileAccess,
      companyCreditEnabled,
      quoteEnabled,
      requisitionEnabled,
    },
  );
  const sources = {};
  const data = await fetchDashboardData(
    analyticsRequirements,
    apis,
    analyticsConfig,
    sources,
  );
  const { orderHistory } = data;
  const companyCredit = companyCreditEnabled ? data.companyCredit : null;
  const quotes = quoteEnabled ? data.negotiableQuotes : null;
  let purchaseOrders = null;
  if (hasPurchaseOrderCompanyAccess) {
    purchaseOrders = data.companyPurchaseOrders || data.allPurchaseOrders;
  } else if (hasPurchaseOrderCustomerAccess) {
    purchaseOrders = data.allPurchaseOrders;
  }
  const viewModel = buildViewModel(
    analyticsConfig,
    analyticsRequirements,
    data,
    sources,
  );

  const purchaseOrderItems = Array.isArray(purchaseOrders?.purchaseOrderItems)
    ? purchaseOrders.purchaseOrderItems
    : [];
  const featuredEntry = buildFeaturedEntry(purchaseOrderItems);
  const spotlightItems = buildSpotlightItems(purchaseOrderItems, rowsLimit);

  const quoteItems = Array.isArray(quotes?.items) ? quotes.items : [];
  const openQuotesCount = quoteEnabled
    ? quoteItems.filter((quote) => !TERMINAL_QUOTE_STATUSES.has(String(quote?.status || '').toUpperCase())).length
    : undefined;

  return {
    permissions,
    customer,
    orderHistory,
    company,
    companyCredit,
    companyCreditEnabled,
    quoteEnabled,
    requisitionEnabled,
    hasCompanyProfileAccess,
    hasPurchaseOrderAccess,
    purchaseOrderSource,
    purchaseOrders,
    featuredEntry,
    spotlightItems,
    openQuotesCount,
    analytics: {
      config: analyticsConfig,
      requirements: analyticsRequirements,
      sources,
      viewModel,
    },
  };
}

function buildHeaderStats(state) {
  const stats = [];
  const availableCredit = state.companyCredit?.credit?.available_credit;
  const poCount = state.purchaseOrders?.totalCount;

  if (availableCredit && typeof availableCredit.value === 'number') {
    stats.push({
      value: formatMoney(availableCredit.value, availableCredit.currency),
      label: 'Available Credit',
    });
  }

  if (typeof poCount === 'number') {
    stats.push({
      value: formatCount(poCount),
      label: state.purchaseOrderSource === 'company' ? 'Company PO Count' : 'Purchase Orders',
    });
  }

  if (typeof state.openQuotesCount === 'number') {
    stats.push({
      value: formatCount(state.openQuotesCount),
      label: 'Open Quotes',
    });
  }

  return stats;
}

function moduleIcon(index) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');

  const paths = [
    '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    '<path d="M3 7h18"/><path d="M7 3v18"/><path d="M17 3v18"/><path d="M3 17h18"/>',
  ];

  svg.innerHTML = paths[index % paths.length];
  return svg;
}

function spotlightIcon(index) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');

  const paths = [
    '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  ];

  svg.innerHTML = paths[index % paths.length];
  return svg;
}

function proofIcon(index) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');

  const paths = [
    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
    '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  ];

  svg.innerHTML = paths[index % paths.length];
  return svg;
}

function buildRackSvg() {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '180');
  svg.setAttribute('height', '200');
  svg.setAttribute('viewBox', '0 0 180 200');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.opacity = '0.35';
  svg.style.position = 'absolute';

  const create = (tag, attrs = {}) => {
    const node = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };

  svg.append(create('rect', {
    x: '20',
    y: '10',
    width: '140',
    height: '180',
    rx: '2',
    stroke: 'white',
    'stroke-width': '1',
  }));

  const rails = [24, 46, 68, 90, 112, 134, 156];
  rails.forEach((y, index) => {
    svg.append(create('rect', {
      x: '32',
      y: `${y}`,
      width: '116',
      height: '16',
      rx: '1',
      fill: index === 2 ? '#26a067' : 'white',
      'fill-opacity': index === 2 ? '0.3' : '0.08',
      stroke: index === 2 ? '#26a067' : 'white',
      'stroke-width': '0.5',
    }));
  });

  [32, 54, 76, 98].forEach((cy) => {
    svg.append(create('circle', {
      cx: '136',
      cy: `${cy}`,
      r: '3',
      fill: '#26a067',
      'fill-opacity': cy === 76 ? '1' : '0.7',
    }));
  });

  return svg;
}

function renderHeader(config, stats) {
  const title = el('h2', 'vmb-title');
  title.innerHTML = config.titleHTML;

  return el('div', 'vmb-header', {}, [
    el('div', 'vmb-header-left', {}, [
      el('div', 'vmb-eyebrow', {}, [
        el('div', 'vmb-eyebrow-diamond', { 'aria-hidden': 'true' }),
        el('span', 'vmb-eyebrow-text', {}, [text(config.eyebrowText)]),
      ]),
      title,
      el('p', 'vmb-sub', {}, [text(config.subtitle)]),
    ]),
    stats.length
      ? el(
        'div',
        'vmb-header-right',
        { 'aria-label': 'Live member statistics' },
        stats.map((stat) => el('div', 'vmb-stat', {}, [
          el('div', 'vmb-stat-val', {}, [text(stat.value)]),
          el('div', 'vmb-stat-label', {}, [text(stat.label)]),
        ])),
      )
      : null,
  ]);
}

function renderStateCard({
  kicker,
  title,
  body,
  primary,
  secondary,
}) {
  return el('div', 'vmb-card vmb-featured vmb-state-card', {}, [
    el('div', 'vmb-state-content', {}, [
      kicker ? el('div', 'vmb-state-kicker', {}, [text(kicker)]) : null,
      el('h3', 'vmb-state-title', {}, [text(title)]),
      el('p', 'vmb-state-text', {}, [text(body)]),
      el('div', 'vmb-cta-row', {}, [
        primary
          ? el('a', 'vmb-cta vmb-cta-primary', { href: primary.href }, [
            text(primary.label),
            el('span', '', { 'aria-hidden': 'true' }, [text('→')]),
          ])
          : null,
        secondary
          ? el('a', 'vmb-cta vmb-cta-secondary', { href: secondary.href }, [
            text(secondary.label),
          ])
          : null,
      ]),
    ]),
  ]);
}

function renderFeaturedCard(entry) {
  const { po } = entry;
  const hasProductLink = Boolean(
    (entry.item?.product?.urlKey || entry.item?.productUrlKey)
    && (entry.item?.product?.sku || entry.item?.productSku),
  );
  const secondaryHref = hasProductLink
    ? buildProductHref(entry.item, po)
    : resolveHref(CUSTOMER_PO_LIST_PATH);
  const priceTag = po?.order?.orderNumber
    ? `Order ${po.order.orderNumber}`
    : formatStatus(po?.status);
  const description = joinParts([
    entry.sku ? `SKU ${entry.sku}` : '',
    typeof entry.quantity === 'number' ? `Qty ${entry.quantity}` : '',
    formatDate(po?.updatedAt || po?.createdAt),
  ]);

  return el('div', 'vmb-card vmb-featured', {}, [
    el('div', 'vmb-featured-visual', {}, [
      el('div', 'vmb-featured-label', {}, [
        el('div', 'vmb-featured-label-dot', { 'aria-hidden': 'true' }),
        el('span', '', {}, [text('Latest Purchase Order')]),
      ]),
      buildRackSvg(),
      el('div', 'vmb-featured-discount', {}, [
        el('div', 'vmb-featured-discount-pct', {}, [text(`PO #${po?.number || '—'}`)]),
        el('div', 'vmb-featured-discount-label', {}, [text(formatStatus(po?.status) || 'Purchase Order')]),
      ]),
    ]),
    el('div', 'vmb-featured-body', {}, [
      el('div', 'vmb-featured-category', {}, [text(joinParts([
        statefulCompanyName(entry.po),
        po?.createdBy ? joinParts([po.createdBy.firstname, po.createdBy.lastname]).trim() : '',
      ]) || 'Live commerce data')]),
      el('h3', 'vmb-featured-title', {}, [text(entry.productName || `PO #${po?.number || ''}`)]),
      el('div', 'vmb-featured-desc', {}, [text(description || 'View the latest accessible purchase order line item.')]),
      el('div', 'vmb-featured-pricing', {}, [
        entry.unitPriceLabel ? el('div', 'vmb-price-member', {}, [text(entry.unitPriceLabel)]) : null,
        entry.lineTotalLabel ? el('div', 'vmb-price-was', {}, [text(`Line ${entry.lineTotalLabel}`)]) : null,
        priceTag ? el('div', 'vmb-price-tag', {}, [text(priceTag)]) : null,
      ]),
      el('div', 'vmb-cta-row', {}, [
        el('a', 'vmb-cta vmb-cta-primary', { href: buildPoDetailHref(po) }, [
          text('View Purchase Order'),
          el('span', '', { 'aria-hidden': 'true' }, [text('→')]),
        ]),
        el('a', 'vmb-cta vmb-cta-secondary', { href: secondaryHref }, [
          text(hasProductLink ? 'View Product' : 'Open Purchase Orders'),
        ]),
      ]),
    ]),
  ]);
}

function statefulCompanyName(po) {
  return po?.quote?.shippingAddress?.company || po?.quote?.billingAddress?.company || '';
}

function renderModulesCard(moduleLinks) {
  return el('section', 'vmb-card vmb-modules', { 'aria-label': 'Member account routes' }, [
    el('div', 'vmb-modules-header', {}, [
      el('span', 'vmb-modules-label', {}, [text('Member Routes')]),
      el('span', 'vmb-modules-count', {}, [text(`${moduleLinks.length} live destinations`)]),
    ]),
    el('div', 'vmb-module-grid', {}, moduleLinks.map((module, index) => el(
      'a',
      'vmb-module-item',
      { href: module.href },
      [
        el('div', 'vmb-module-icon', { 'aria-hidden': 'true' }, [moduleIcon(index)]),
        el('div', 'vmb-module-title', {}, [text(module.title)]),
        el('div', 'vmb-module-desc', {}, [text(module.description)]),
        el('div', 'vmb-module-link', {}, [
          text(module.cta),
          el('span', '', { 'aria-hidden': 'true' }, [text(' →')]),
        ]),
      ],
    ))),
  ]);
}

function renderModulesStateCard() {
  return el('section', 'vmb-card vmb-modules', { 'aria-label': 'Member account routes' }, [
    el('div', 'vmb-modules-header', {}, [
      el('span', 'vmb-modules-label', {}, [text('Member Routes')]),
      el('span', 'vmb-modules-count', {}, [text('Core routes only')]),
    ]),
    el('div', 'vmb-module-grid', {}, [
      el('div', 'vmb-module-item', {}, [
        el('div', 'vmb-module-title', {}, [text('No additional modules are available.')]),
        el('div', 'vmb-module-desc', {}, [
          text('This account can still use the real My Account, Orders, and Addresses pages below.'),
        ]),
      ]),
    ]),
  ]);
}

function renderSpotlightCard(items, purchaseOrders) {
  const totalCount = typeof purchaseOrders?.totalCount === 'number'
    ? formatCount(purchaseOrders.totalCount)
    : '';

  return el('div', 'vmb-card vmb-spotlight', {}, [
    el('div', 'vmb-spotlight-header', {}, [
      el('span', 'vmb-spotlight-label', {}, [text('Recent PO Lines')]),
      el('span', 'vmb-spotlight-count', {}, [text(items.length ? `${items.length} live SKUs` : 'No live SKUs yet')]),
    ]),
    items.length
      ? el(
        'div',
        'vmb-spotlight-items',
        { role: 'list', 'aria-label': 'Recent purchase order line items' },
        items.map((item, index) => el(
          'a',
          'vmb-spotlight-item',
          {
            href: item.href,
            role: 'listitem',
            'aria-label': `${item.productName || item.sku}, ${item.meta}`,
          },
          [
            el('div', 'vmb-spotlight-thumb', { 'aria-hidden': 'true' }, [spotlightIcon(index)]),
            el('div', 'vmb-spotlight-info', {}, [
              el('span', 'vmb-spotlight-name', {}, [text(item.productName || item.sku || 'Purchase order line item')]),
              el('span', 'vmb-spotlight-meta', {}, [text(item.meta)]),
            ]),
            el('div', 'vmb-spotlight-pricing', {}, [
              item.unitPriceLabel
                ? el('span', 'vmb-spotlight-price', {}, [text(item.unitPriceLabel)])
                : null,
              item.lineTotalLabel
                ? el('span', 'vmb-spotlight-price-was', {}, [text(item.lineTotalLabel)])
                : null,
            ]),
          ],
        )),
      )
      : el('div', 'vmb-spotlight-items', {}, [
        el('p', 'vmb-empty-note', {}, [
          text('No accessible purchase-order line items are available for this account yet.'),
        ]),
      ]),
    el('div', 'vmb-spotlight-footer', {}, [
      el('span', 'vmb-spotlight-footer-text', {}, [
        text(totalCount ? `${totalCount} accessible purchase orders` : 'Real purchase-order destinations only'),
      ]),
      el('a', 'vmb-spotlight-footer-link', { href: resolveHref(CUSTOMER_PO_LIST_PATH) }, [
        text('View All Purchase Orders'),
        el('span', '', { 'aria-hidden': 'true' }, [text(' →')]),
      ]),
    ]),
  ]);
}

function renderAccountCard(state) {
  const customerName = getCustomerName(state.customer);
  const accountName = state.company?.name
    ? `${customerName} · ${state.company.name}`
    : customerName;
  const accountMeta = joinParts([
    state.company?.customerRole?.name,
    state.company?.customerStatus,
    state.customer?.email,
  ]) || 'Authenticated account';
  const metrics = buildAccountMetrics(state);
  const actions = [
    {
      label: 'My Account',
      href: resolveHref(CUSTOMER_ACCOUNT_PATH),
      badge: state.company?.customerRole?.name || '',
    },
    {
      label: 'Orders',
      href: resolveHref(CUSTOMER_ORDERS_PATH),
      badge: typeof state.orderHistory?.totalCount === 'number' ? formatCount(state.orderHistory.totalCount) : '',
    },
    {
      label: 'Addresses',
      href: resolveHref(CUSTOMER_ADDRESS_PATH),
      badge: '',
    },
  ];

  return el('div', 'vmb-card vmb-account', {}, [
    el('div', 'vmb-account-header', {}, [
      el('div', 'vmb-account-header-top', {}, [
        el('span', 'vmb-account-header-label', {}, [text('Account Overview')]),
        el('div', 'vmb-account-live', { 'aria-label': 'Live account data' }, [
          el('div', 'vmb-live-dot', { 'aria-hidden': 'true' }),
          text('Live'),
        ]),
      ]),
      el('div', 'vmb-account-name', {}, [text(accountName)]),
      el('div', 'vmb-account-org', {}, [text(accountMeta)]),
    ]),
    metrics.length
      ? el(
        'div',
        'vmb-account-metrics',
        { role: 'list', 'aria-label': 'Account metrics' },
        metrics.map((metric) => el('div', 'vmb-metric', { role: 'listitem' }, [
          el('div', 'vmb-metric-val', {}, [text(metric.value)]),
          el('div', 'vmb-metric-label', {}, [text(metric.label)]),
        ])),
      )
      : null,
    el('div', 'vmb-account-actions', {}, actions.map((action) => el(
      'a',
      'vmb-action-row',
      { href: action.href },
      [
        el('span', 'vmb-action-label', {}, [text(action.label)]),
        action.badge ? el('span', 'vmb-action-badge', {}, [text(action.badge)]) : null,
        el('span', 'vmb-action-arrow', { 'aria-hidden': 'true' }, [text('→')]),
      ],
    ))),
  ]);
}

function renderProofStrip(state) {
  const proofItems = buildProofItems(state);

  return el('div', 'vmb-proof-real', {}, [
    el(
      'div',
      'vmb-proof-real-grid',
      {},
      proofItems.length
        ? proofItems.map((item, index) => el('div', 'vmb-proof-real-item', {}, [
          el('div', 'vmb-proof-icon', { 'aria-hidden': 'true' }, [proofIcon(index)]),
          el('div', 'vmb-proof-text', {}, [
            el('div', 'vmb-proof-title', {}, [text(item.title)]),
            el('div', 'vmb-proof-sub', {}, [text(item.sub)]),
          ]),
        ]))
        : [
          el('div', 'vmb-proof-real-item vmb-proof-real-item--empty', {}, [
            el('div', 'vmb-proof-text', {}, [
              el('div', 'vmb-proof-title', {}, [text('Account Context')]),
              el('div', 'vmb-proof-sub', {}, [text('Open your real account pages to view more live company details.')]),
            ]),
          ]),
        ],
    ),
    el('a', 'vmb-proof-cta', { href: resolveHref(CUSTOMER_ACCOUNT_PATH) }, [
      el('div', 'vmb-proof-cta-text', {}, [
        el('div', 'vmb-proof-cta-main', {}, [text('Open My Account')]),
        el('div', 'vmb-proof-cta-sub', {}, [text('Real site destinations only')]),
      ]),
      el('div', 'vmb-proof-cta-arrow', { 'aria-hidden': 'true' }, [text('→')]),
    ]),
  ]);
}

function createAnalyticsSurface(className, href, ariaLabel) {
  const tag = href ? 'a' : 'article';
  const attrs = href
    ? { href, 'aria-label': ariaLabel }
    : { 'aria-label': ariaLabel };
  return el(tag, className, attrs);
}

function createEmptyChart(id, title, description, type = 'bar') {
  return {
    id,
    title,
    description,
    type,
    state: 'empty',
    emptyText: FALLBACK_TEXT,
  };
}

function getChartTypeLabel(type) {
  const labels = {
    line: 'Line Graph',
    bar: 'Bar Chart',
    donut: 'Donut Chart',
    stacked: 'Stacked Flow',
  };

  return labels[type] || 'Live Chart';
}

function getMetricValue(viewModel, id) {
  return viewModel?.metrics?.[id]?.value || FALLBACK_TEXT;
}

function buildAnalyticsCharts(state) {
  const { viewModel } = state.analytics;
  const byId = new Map(
    (Array.isArray(viewModel?.charts) ? viewModel.charts : [])
      .map((chart) => [chart.id, chart]),
  );

  return [
    {
      id: 'order-value-trend',
      chart: byId.get('order-value-trend')
        || createEmptyChart(
          'order-value-trend',
          'Order Value Trend',
          'Recent order totals over time.',
          'line',
        ),
      href: resolveHref(CUSTOMER_ORDERS_PATH),
      cta: 'Open Orders',
    },
    {
      id: 'po-status-breakdown',
      chart: byId.get('po-status-breakdown')
        || createEmptyChart(
          'po-status-breakdown',
          'PO Status Breakdown',
          'Distribution of accessible purchase orders by status.',
        ),
      href: state.hasPurchaseOrderAccess ? resolveHref(CUSTOMER_PO_LIST_PATH) : '',
      cta: 'View Purchase Orders',
    },
    {
      id: 'team-status-split',
      chart: byId.get('team-status-split')
        || createEmptyChart(
          'team-status-split',
          'Team Status Split',
          'Active vs inactive company users.',
          'donut',
        ),
      href: state.hasCompanyProfileAccess ? resolveHref(CUSTOMER_COMPANY_PROFILE_PATH) : '',
      cta: 'Open Company Profile',
    },
    {
      id: 'quote-pipeline',
      chart: byId.get('quote-pipeline')
        || createEmptyChart(
          'quote-pipeline',
          'Quote Pipeline',
          'Stacked distribution of negotiable quote statuses.',
          'stacked',
        ),
      href: state.quoteEnabled ? resolveHref(CUSTOMER_NEGOTIABLE_QUOTE_PATH) : '',
      cta: 'Open Quotes',
    },
  ];
}

function buildInsightTiles(state) {
  const { config, viewModel } = state.analytics;
  const orderWindowDays = viewModel?.windows?.orderWindowDays || config.orderWindowDays;
  const creditHref = state.companyCreditEnabled
    ? resolveHref(CUSTOMER_COMPANY_CREDIT_PATH)
    : '';
  const companyHref = state.hasCompanyProfileAccess
    ? resolveHref(CUSTOMER_COMPANY_PROFILE_PATH)
    : '';
  const sourcingHref = state.requisitionEnabled
    ? resolveHref(CUSTOMER_REQUISITION_LISTS_PATH)
    : '';
  const quoteHref = state.quoteEnabled
    ? resolveHref(CUSTOMER_NEGOTIABLE_QUOTE_PATH)
    : '';

  return [
    {
      id: 'window-spend',
      title: `${orderWindowDays}-Day Spend / AOV`,
      href: resolveHref(CUSTOMER_ORDERS_PATH),
      cta: 'Open Orders',
      items: [
        {
          label: `Spend (${orderWindowDays}d)`,
          value: getMetricValue(viewModel, 'windowSpend'),
        },
        {
          label: 'AOV',
          value: getMetricValue(viewModel, 'orderAov'),
        },
      ],
    },
    {
      id: 'po-pipeline',
      title: 'PO Pipeline / Pending Approvals',
      href: state.hasPurchaseOrderAccess ? resolveHref(CUSTOMER_PO_LIST_PATH) : '',
      cta: 'View Purchase Orders',
      items: [
        {
          label: 'Pipeline Value',
          value: getMetricValue(viewModel, 'poPipelineValue'),
        },
        {
          label: 'Pending Approvals',
          value: getMetricValue(viewModel, 'pendingApprovals'),
        },
      ],
    },
    {
      id: 'credit-posture',
      title: 'Available Credit / Utilization',
      href: creditHref || companyHref,
      cta: state.companyCreditEnabled ? 'View Company Credit' : 'Open Company Profile',
      items: [
        {
          label: 'Available Credit',
          value: getMetricValue(viewModel, 'creditAvailable'),
        },
        {
          label: 'Utilization',
          value: getMetricValue(viewModel, 'creditUtilization'),
        },
      ],
    },
    {
      id: 'sourcing-queue',
      title: 'Sourcing Queue',
      href: sourcingHref || quoteHref,
      cta: state.requisitionEnabled ? 'Open Requisition Lists' : 'Open Quotes',
      items: [
        {
          label: 'Open Quotes',
          value: getMetricValue(viewModel, 'openQuotes'),
        },
        {
          label: 'Req. Lists',
          value: getMetricValue(viewModel, 'requisitionListCount'),
        },
        {
          label: 'Wishlist Items',
          value: getMetricValue(viewModel, 'wishlistItems'),
        },
        {
          label: 'Cart Qty',
          value: getMetricValue(viewModel, 'cartQuantity'),
        },
      ],
    },
  ];
}

function renderAnalyticsChartCard(card) {
  const title = card.chart?.title || 'Live Commerce Chart';
  const description = card.chart?.description || 'Real commerce analytics.';
  let stateText = 'Watching';
  if (card.href) {
    stateText = card.cta;
  } else if (card.chart.state === 'ready') {
    stateText = 'Live data';
  }
  const surface = createAnalyticsSurface(
    'vmb-analytics-card vmb-analytics-card--chart',
    card.href,
    title,
  );
  const visual = el('div', 'vmb-analytics-card-visual', {});
  visual.append(markup(renderChartMarkup(card.chart)));

  surface.append(
    el('div', 'vmb-analytics-card-top', {}, [
      el('span', 'vmb-analytics-card-kicker', {}, [text(getChartTypeLabel(card.chart.type))]),
      el('span', 'vmb-analytics-card-state', {}, [text(stateText)]),
    ]),
    el('h3', 'vmb-analytics-card-title', {}, [text(title)]),
    el('p', 'vmb-analytics-card-desc', {}, [text(description)]),
    visual,
    card.href
      ? el('div', 'vmb-analytics-card-footer', {}, [
        text(card.cta),
        el('span', '', { 'aria-hidden': 'true' }, [text(' →')]),
      ])
      : null,
  );

  return surface;
}

function renderInsightTile(tile) {
  const surface = createAnalyticsSurface(
    'vmb-analytics-insight',
    tile.href,
    tile.title,
  );

  surface.append(
    el('div', 'vmb-analytics-insight-top', {}, [
      el('div', 'vmb-analytics-insight-title', {}, [text(tile.title)]),
      tile.href
        ? el('div', 'vmb-analytics-insight-cta', {}, [
          text(tile.cta),
          el('span', '', { 'aria-hidden': 'true' }, [text(' →')]),
        ])
        : null,
    ]),
    el(
      'div',
      `vmb-analytics-insight-grid vmb-analytics-insight-grid--${tile.items.length}`,
      {},
      tile.items.map((item) => el('div', 'vmb-analytics-insight-item', {}, [
        el('div', 'vmb-analytics-insight-value', {}, [text(item.value)]),
        el('div', 'vmb-analytics-insight-label', {}, [text(item.label)]),
      ])),
    ),
  );

  return surface;
}

function renderAnalyticsSection(state) {
  const { sources, viewModel } = state.analytics;
  const sourceEntries = Object.values(sources || {});
  const liveCount = sourceEntries.filter((source) => source?.status === 'ok').length;
  const chartCards = buildAnalyticsCharts(state);
  const insightTiles = buildInsightTiles(state);

  return el('section', 'vmb-card vmb-analytics live-block', {
    'aria-label': 'Member Intelligence Dashboard',
  }, [
    el('div', 'vmb-analytics-header', {}, [
      el('div', 'vmb-analytics-header-copy', {}, [
        el('div', 'vmb-analytics-kicker', {}, [text('Member Intelligence Dashboard')]),
        el('h3', 'vmb-analytics-heading', {}, [text('Real procurement and commerce telemetry.')]),
        el('p', 'vmb-analytics-sub', {}, [
          text(
            `Updated ${formatDateTime(viewModel?.lastUpdatedAt)} across `
            + `${liveCount}/${sourceEntries.length || 0} live sources.`,
          ),
        ]),
      ]),
      el('div', 'vmb-analytics-header-meta', {}, [
        el('span', 'live-block-pill vmb-analytics-pill', {}, [text('Live')]),
      ]),
    ]),
    el(
      'div',
      'vmb-analytics-chart-grid',
      {},
      chartCards.map((card) => renderAnalyticsChartCard(card)),
    ),
    el('section', 'vmb-analytics-insights-strip', { 'aria-label': 'Commerce insights' }, [
      el('div', 'vmb-analytics-insights-head', {}, [
        el('span', 'vmb-analytics-insights-label', {}, [text('Cool Insights')]),
        el('span', 'vmb-analytics-insights-meta', {}, [text('Real commerce data only')]),
      ]),
      el(
        'div',
        'vmb-analytics-insights-grid',
        {},
        insightTiles.map((tile) => renderInsightTile(tile)),
      ),
    ]),
  ]);
}

function renderGuest(block, config) {
  const header = renderHeader(config, []);
  const stateCard = renderStateCard({
    kicker: 'Guest View',
    title: 'Sign in to reveal live commerce data.',
    body: 'This VIP block only renders real purchase orders, SKU names, pricing, and account routes for authenticated members.',
    primary: {
      label: config.guestCtaLabel,
      href: resolveHref(config.guestCtaHref),
    },
    secondary: {
      label: 'Open My Account',
      href: resolveHref(CUSTOMER_ACCOUNT_PATH),
    },
  });

  block.replaceChildren(header, stateCard);
}

function renderLoading(block, config) {
  const header = renderHeader(config, []);
  const stateCard = renderStateCard({
    kicker: 'Loading',
    title: 'Loading live member data.',
    body: 'Fetching purchase orders, account routes, and real SKU information for this member context.',
  });

  block.replaceChildren(header, stateCard);
}

function renderError(block, config) {
  const header = renderHeader(config, []);
  const stateCard = renderStateCard({
    kicker: 'Partial Error',
    title: 'Live member data could not be fully loaded.',
    body: 'The block is falling back to real account destinations only. Refresh the page to retry live PO and quote data.',
    primary: {
      label: 'Open My Account',
      href: resolveHref(CUSTOMER_ACCOUNT_PATH),
    },
    secondary: {
      label: 'Orders',
      href: resolveHref(CUSTOMER_ORDERS_PATH),
    },
  });

  block.replaceChildren(header, stateCard);
}

function renderAuthenticated(block, config, state) {
  const header = renderHeader(config, buildHeaderStats(state));
  const moduleLinks = buildModuleLinks(state);
  const spotlightItems = state.spotlightItems.slice(0, config.rowsLimit);

  const featuredCard = state.featuredEntry
    ? renderFeaturedCard(state.featuredEntry)
    : renderStateCard({
      kicker: 'Purchase Orders',
      title: 'No live PO line items are available yet.',
      body: 'As soon as this account has accessible purchase orders, this panel will render the newest PO line with its real product name and SKU.',
      primary: state.hasPurchaseOrderAccess
        ? {
          label: 'Open Purchase Orders',
          href: resolveHref(CUSTOMER_PO_LIST_PATH),
        }
        : {
          label: 'Open My Account',
          href: resolveHref(CUSTOMER_ACCOUNT_PATH),
        },
      secondary: state.quoteEnabled
        ? {
          label: 'Open Quotes',
          href: resolveHref(CUSTOMER_NEGOTIABLE_QUOTE_PATH),
        }
        : null,
    });

  const moduleCard = moduleLinks.length
    ? renderModulesCard(moduleLinks)
    : renderModulesStateCard();

  const grid = el('div', 'vmb-grid', {}, [
    featuredCard,
    moduleCard,
    renderSpotlightCard(spotlightItems, state.purchaseOrders),
    renderAccountCard(state),
  ]);

  block.replaceChildren(
    header,
    grid,
    renderProofStrip(state),
    renderAnalyticsSection(state),
  );
}

export default async function decorate(block) {
  const config = readAuthorConfig(block);
  let refreshToken = 0;
  let refreshTimeout;
  let disposed = false;

  const subscriptions = [];

  block.classList.add('vip-member-block');
  block.classList.add('vip-member-block-real-v2');
  block.setAttribute('role', 'region');
  block.setAttribute('aria-label', 'VIP member block with live commerce data');

  const refresh = async (reason = 'event') => {
    const currentToken = refreshToken + 1;
    refreshToken = currentToken;

    if (!checkIsAuthenticated()) {
      renderGuest(block, config);
      return;
    }

    renderLoading(block, config);

    try {
      const state = await fetchLiveState(config.rowsLimit);

      if (disposed || currentToken !== refreshToken) return;
      if (!checkIsAuthenticated()) {
        renderGuest(block, config);
        return;
      }

      renderAuthenticated(block, config, state);
    } catch (error) {
      console.error(`vip-member-block-real-v2: refresh failed during ${reason}`, error);
      if (disposed || currentToken !== refreshToken) return;
      renderError(block, config);
    }
  };

  const scheduleRefresh = (reason = 'event') => {
    if (refreshTimeout) window.clearTimeout(refreshTimeout);
    refreshTimeout = window.setTimeout(() => {
      refresh(reason);
    }, reason === 'manual' ? 0 : 120);
  };

  await refresh('load');

  subscriptions.push(events.on('authenticated', () => {
    scheduleRefresh('authenticated');
  }, { eager: true }));

  subscriptions.push(events.on('auth/permissions', () => {
    scheduleRefresh('auth/permissions');
  }, { eager: true }));

  subscriptions.push(events.on('purchase-order/refresh', () => {
    if (checkIsAuthenticated()) scheduleRefresh('purchase-order/refresh');
  }));

  subscriptions.push(events.on('cart/data', () => {
    if (checkIsAuthenticated()) scheduleRefresh('cart/data');
  }));

  subscriptions.push(events.on('quote-management/negotiable-quote-requested', () => {
    if (checkIsAuthenticated()) scheduleRefresh('quote-management/negotiable-quote-requested');
  }));

  subscriptions.push(events.on('quote-management/quote-duplicated', () => {
    if (checkIsAuthenticated()) scheduleRefresh('quote-management/quote-duplicated');
  }));

  subscriptions.push(events.on('quote-management/quote-template-generated', () => {
    if (checkIsAuthenticated()) scheduleRefresh('quote-management/quote-template-generated');
  }));

  subscriptions.push(events.on('wishlist/alert', () => {
    if (checkIsAuthenticated()) scheduleRefresh('wishlist/alert');
  }));

  const observer = new MutationObserver(() => {
    if (!document.body.contains(block)) {
      disposed = true;

      if (refreshTimeout) {
        window.clearTimeout(refreshTimeout);
      }

      subscriptions.forEach((subscription) => {
        subscription?.off?.();
      });

      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
