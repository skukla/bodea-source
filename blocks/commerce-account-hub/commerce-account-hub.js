import { events } from '@dropins/tools/event-bus.js';
import { readBlockConfig } from '../../scripts/aem.js';
import {
  checkIsAuthenticated,
  CUSTOMER_ACCOUNT_PATH,
  CUSTOMER_ADDRESS_PATH,
  CUSTOMER_LOGIN_PATH,
  CUSTOMER_NEGOTIABLE_QUOTE_PATH,
  CUSTOMER_NEGOTIABLE_QUOTE_TEMPLATE_PATH,
  CUSTOMER_ORDERS_PATH,
  CUSTOMER_REQUISITION_LISTS_PATH,
  rootLink,
} from '../../scripts/commerce.js';

const CUSTOMER_COMPANY_PROFILE_PATH = '/customer/company';
const CUSTOMER_COMPANY_STRUCTURE_PATH = '/customer/company/structure';
const CUSTOMER_COMPANY_USERS_PATH = '/customer/company/users';
const CUSTOMER_COMPANY_ROLES_PATH = '/customer/company/roles';
const CUSTOMER_COMPANY_CREDIT_PATH = '/customer/company/credit';

const QUOTE_PERMISSION_KEYS = [
  'Magento_NegotiableQuote::all',
  'Magento_NegotiableQuote::view_quotes',
  'Magento_NegotiableQuote::manage',
];

const TEMPLATE_PERMISSION_KEYS = [
  'Magento_NegotiableQuoteTemplate::all',
  'Magento_NegotiableQuoteTemplate::view_template',
  'Magento_NegotiableQuoteTemplate::manage',
];

const MODULE_CARD_DEFINITIONS = [
  {
    id: 'company-profile',
    title: 'Company Profile',
    description: 'Manage company account details',
    href: CUSTOMER_COMPANY_PROFILE_PATH,
    countKey: null,
  },
  {
    id: 'company-structure',
    title: 'Company Structure',
    description: 'Manage company structure',
    href: CUSTOMER_COMPANY_STRUCTURE_PATH,
    countKey: null,
  },
  {
    id: 'company-users',
    title: 'Company Users',
    description: 'Manage company users',
    href: CUSTOMER_COMPANY_USERS_PATH,
    countKey: 'usersCount',
  },
  {
    id: 'roles',
    title: 'Roles & Permissions',
    description: 'Manage company roles',
    href: CUSTOMER_COMPANY_ROLES_PATH,
    countKey: 'rolesCount',
  },
  {
    id: 'credit',
    title: 'Company Credit',
    description: 'View company credit status',
    href: CUSTOMER_COMPANY_CREDIT_PATH,
    countKey: 'creditAvailable',
  },
  {
    id: 'quotes',
    title: 'Quotes',
    description: 'Manage negotiable quotes',
    href: CUSTOMER_NEGOTIABLE_QUOTE_PATH,
    countKey: 'quoteCount',
  },
  {
    id: 'quote-templates',
    title: 'Quote Templates',
    description: 'Manage reusable quote templates',
    href: CUSTOMER_NEGOTIABLE_QUOTE_TEMPLATE_PATH,
    countKey: 'templateCount',
  },
  {
    id: 'requisition-lists',
    title: 'Requisition Lists',
    description: 'Manage requisition lists',
    href: CUSTOMER_REQUISITION_LISTS_PATH,
    countKey: 'requisitionCount',
  },
];

const DEFAULT_CONFIG = {
  title: 'My Account Hub',
  rowsLimit: 3,
  showOrders: true,
  showAddresses: true,
  showModuleCards: false,
  guestCtaLabel: 'Sign in',
  guestCtaHref: CUSTOMER_LOGIN_PATH,
};

const MIN_ROWS = 1;
const MAX_ROWS = 5;
const FALLBACK_TEXT = 'Not available';
const LOADING_TEXT = 'Loading...';

/**
 * Parse string/boolean as boolean.
 * @param {string | boolean | undefined} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
function parseBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

/**
 * Parse string/number as integer and clamp.
 * @param {string | number | undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(MIN_ROWS, Math.min(MAX_ROWS, parsed));
}

/**
 * Convert raw configuration to normalized options.
 * @param {HTMLElement} block
 * @returns {object}
 */
function getConfig(block) {
  const config = readBlockConfig(block);

  return {
    title: config.title?.trim() || DEFAULT_CONFIG.title,
    rowsLimit: parseInteger(config['rows-limit'], DEFAULT_CONFIG.rowsLimit),
    showOrders: parseBoolean(config['show-orders'], DEFAULT_CONFIG.showOrders),
    showAddresses: parseBoolean(config['show-addresses'], DEFAULT_CONFIG.showAddresses),
    showModuleCards: parseBoolean(config['show-module-cards'], DEFAULT_CONFIG.showModuleCards),
    guestCtaLabel: config['guest-cta-label']?.trim() || DEFAULT_CONFIG.guestCtaLabel,
    guestCtaHref: config['guest-cta-href']?.trim() || DEFAULT_CONFIG.guestCtaHref,
  };
}

/**
 * Resolve a route/path for the current locale.
 * @param {string} href
 * @returns {string}
 */
function resolveHref(href) {
  if (!href) return rootLink(CUSTOMER_ACCOUNT_PATH);
  if (href.startsWith('/')) return rootLink(href);
  return href;
}

/**
 * Create a DOM element.
 * @param {string} tagName
 * @param {string} className
 * @param {string} text
 * @returns {HTMLElement}
 */
function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (typeof text === 'string') element.textContent = text;
  return element;
}

/**
 * Coerce a feature flag into boolean.
 * @param {unknown} value
 * @returns {boolean}
 */
function isTruthyFlag(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

/**
 * Determine whether any permission is explicitly disabled.
 * @param {Record<string, boolean>} permissions
 * @param {string[]} keys
 * @returns {boolean}
 */
function isExplicitlyDisabled(permissions, keys) {
  return keys.some((key) => permissions[key] === false);
}

/**
 * Determine whether permission set is granted.
 * @param {Record<string, boolean>} permissions
 * @param {string[]} keys
 * @returns {boolean}
 */
function isPermissionGranted(permissions, keys) {
  if (keys.length === 0 || keys.includes('all')) return true;
  if (permissions.admin || permissions.all) return true;
  return keys.some((key) => permissions[key] === true);
}

/**
 * Determine if a permission set is available.
 * @param {Record<string, boolean>} permissions
 * @param {string[]} keys
 * @returns {boolean}
 */
function canUsePermissionSet(permissions, keys) {
  if (isExplicitlyDisabled(permissions, keys)) return false;
  return isPermissionGranted(permissions, keys);
}

/**
 * Get a safe permissions snapshot.
 * @returns {Record<string, boolean>}
 */
function getPermissionsSnapshot() {
  const snapshot = events.lastPayload('auth/permissions');
  if (!snapshot || typeof snapshot !== 'object') return {};
  return snapshot;
}

/**
 * Format number counts for display.
 * @param {number | undefined} value
 * @returns {string}
 */
function formatCount(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return FALLBACK_TEXT;
  return value.toLocaleString('en-US');
}

/**
 * Format money for display.
 * @param {number | undefined} value
 * @param {string | undefined} currency
 * @returns {string}
 */
function formatMoney(value, currency) {
  if (typeof value !== 'number' || Number.isNaN(value) || !currency) return FALLBACK_TEXT;

  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/**
 * Compute full customer name.
 * @param {object | null} customer
 * @returns {string}
 */
function getCustomerName(customer) {
  if (!customer) return 'Customer';
  const firstName = customer.firstName || customer.firstname || '';
  const lastName = customer.lastName || customer.lastname || '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || 'Customer';
}

/**
 * Build initial runtime state.
 * @param {object} config
 * @returns {object}
 */
function createInitialState(config) {
  return {
    config,
    permissions: {},
    customerName: 'Customer',
    companyName: '',
    orderCount: undefined,
    usersCount: undefined,
    rolesCount: undefined,
    creditAvailable: undefined,
    creditCurrency: undefined,
    quoteCount: undefined,
    templateCount: undefined,
    requisitionCount: undefined,
    companyEnabled: false,
    hasCompany: false,
    companyCreditEnabled: false,
    quoteEnabled: false,
    quoteTemplateEnabled: false,
    requisitionEnabled: false,
    isLoadingCritical: true,
    isLoadingTier2: false,
    isLoadingTier3: false,
    hasError: false,
  };
}

/**
 * Build text value with loading fallback.
 * @param {object} options
 * @param {boolean} options.loading
 * @param {string | undefined} options.value
 * @returns {string}
 */
function loadingValue({ loading, value }) {
  if (loading) return LOADING_TEXT;
  return value || FALLBACK_TEXT;
}

/**
 * Add a metric card to the parent container.
 * @param {HTMLElement} parent
 * @param {string} label
 * @param {string} value
 */
function appendMetric(parent, label, value) {
  const card = createElement('article', 'commerce-account-hub-metric');
  const metricLabel = createElement('div', 'commerce-account-hub-metric-label', label);
  const metricValue = createElement('div', 'commerce-account-hub-metric-value', value);

  card.append(metricLabel, metricValue);
  parent.append(card);
}

/**
 * Render guest-safe view.
 * @param {HTMLElement} block
 * @param {object} config
 */
function renderGuest(block, config) {
  const shell = createElement('section', 'commerce-account-hub-shell commerce-account-hub-shell-guest');

  const header = createElement('header', 'commerce-account-hub-header');
  const title = createElement('h2', 'commerce-account-hub-title', config.title);
  const badge = createElement('span', 'commerce-account-hub-badge', 'Guest');
  header.append(title, badge);

  const subtitle = createElement(
    'p',
    'commerce-account-hub-subtitle',
    'Sign in to view live account and B2B company insights.',
  );

  const cta = createElement('a', 'commerce-account-hub-cta', config.guestCtaLabel);
  cta.href = resolveHref(config.guestCtaHref);

  shell.append(header, subtitle, cta);
  block.replaceChildren(shell);
}

/**
 * Build module cards list according to state.
 * @param {object} state
 * @returns {Array<object>}
 */
function buildModuleCards(state) {
  if (!state.config.showModuleCards) return [];
  if (!state.hasCompany) return [];

  const filteredCards = MODULE_CARD_DEFINITIONS.filter((card) => {
    if (card.id === 'credit') return state.companyCreditEnabled;
    if (card.id === 'quotes') return state.quoteEnabled;
    if (card.id === 'quote-templates') return state.quoteTemplateEnabled;
    if (card.id === 'requisition-lists') return state.requisitionEnabled;
    return true;
  });

  const maxRows = parseInteger(state.config.rowsLimit, DEFAULT_CONFIG.rowsLimit);
  const maxCards = maxRows * 2;

  return filteredCards.slice(0, maxCards);
}

/**
 * Resolve metric display text for a module card.
 * @param {object} state
 * @param {object} card
 * @returns {string}
 */
function getModuleCardValue(state, card) {
  if (!card.countKey) return 'Open';

  if (card.countKey === 'creditAvailable') {
    return loadingValue({
      loading: state.isLoadingTier2,
      value: formatMoney(state.creditAvailable, state.creditCurrency),
    });
  }

  const sourceValue = state[card.countKey];
  const loading = card.id === 'quotes'
    || card.id === 'quote-templates'
    || card.id === 'requisition-lists'
    ? state.isLoadingTier3
    : state.isLoadingTier2;

  return loadingValue({ loading, value: formatCount(sourceValue) });
}

/**
 * Render authenticated view.
 * @param {HTMLElement} block
 * @param {object} state
 */
function renderAuthenticated(block, state) {
  const shell = createElement('section', 'commerce-account-hub-shell commerce-account-hub-shell-auth');

  const header = createElement('header', 'commerce-account-hub-header');
  const title = createElement('h2', 'commerce-account-hub-title', state.config.title);
  let badgeText = 'Live';
  if (state.isLoadingCritical) {
    badgeText = 'Loading';
  } else if (state.hasError) {
    badgeText = 'Error';
  }
  const badgeClass = state.hasError
    ? 'commerce-account-hub-badge commerce-account-hub-badge-error'
    : 'commerce-account-hub-badge';
  const badge = createElement('span', badgeClass, badgeText);
  header.append(title, badge);

  const subtitleText = state.hasCompany
    ? `${state.customerName} · ${state.companyName}`
    : `${state.customerName} · Individual account`;
  const subtitle = createElement('p', 'commerce-account-hub-subtitle', subtitleText);

  const metrics = createElement('div', 'commerce-account-hub-metrics');

  appendMetric(
    metrics,
    'Recent Orders',
    loadingValue({
      loading: state.isLoadingCritical,
      value: formatCount(state.orderCount),
    }),
  );

  appendMetric(
    metrics,
    'Company Users',
    state.hasCompany
      ? loadingValue({
        loading: state.isLoadingTier2,
        value: formatCount(state.usersCount),
      })
      : FALLBACK_TEXT,
  );

  appendMetric(
    metrics,
    'Available Credit',
    state.hasCompany && state.companyCreditEnabled
      ? loadingValue({
        loading: state.isLoadingTier2,
        value: formatMoney(state.creditAvailable, state.creditCurrency),
      })
      : FALLBACK_TEXT,
  );

  const quickActions = createElement('div', 'commerce-account-hub-actions');

  const addQuickAction = (label, description, href) => {
    const action = createElement('a', 'commerce-account-hub-action-card');
    action.href = resolveHref(href);

    const actionTitle = createElement('span', 'commerce-account-hub-action-title', label);
    const actionDescription = createElement('span', 'commerce-account-hub-action-description', description);

    action.append(actionTitle, actionDescription);
    quickActions.append(action);
  };

  addQuickAction('My Account', 'Review account details', CUSTOMER_ACCOUNT_PATH);

  if (state.config.showOrders) {
    addQuickAction('Orders', 'Track and manage your orders', CUSTOMER_ORDERS_PATH);
  }

  if (state.config.showAddresses) {
    addQuickAction('Addresses', 'Manage your saved addresses', CUSTOMER_ADDRESS_PATH);
  }

  shell.append(header, subtitle, metrics, quickActions);

  const moduleCards = buildModuleCards(state);
  if (moduleCards.length > 0) {
    const modulesSection = createElement('section', 'commerce-account-hub-modules');
    const modulesHeading = createElement('h3', 'commerce-account-hub-modules-title', 'B2B Modules');
    const modulesGrid = createElement('div', 'commerce-account-hub-modules-grid');

    moduleCards.forEach((card) => {
      const moduleCard = createElement('a', 'commerce-account-hub-module-card');
      moduleCard.href = resolveHref(card.href);

      const moduleTitle = createElement('span', 'commerce-account-hub-module-title', card.title);
      const moduleDescription = createElement('span', 'commerce-account-hub-module-description', card.description);
      const moduleValue = createElement('span', 'commerce-account-hub-module-value', getModuleCardValue(state, card));

      moduleCard.append(moduleTitle, moduleDescription, moduleValue);
      modulesGrid.append(moduleCard);
    });

    modulesSection.append(modulesHeading, modulesGrid);
    shell.append(modulesSection);
  }

  if (state.hasError) {
    const alert = createElement(
      'p',
      'commerce-account-hub-error',
      'Some live data could not be loaded. Try refreshing the page.',
    );
    shell.append(alert);
  }

  block.replaceChildren(shell);
}

/**
 * Safe request wrapper that never throws.
 * @param {Function} callback
 * @returns {Promise<any | null>}
 */
async function safeRequest(callback) {
  try {
    return await callback();
  } catch (error) {
    console.warn('commerce-account-hub: request failed', error);
    return null;
  }
}

/**
 * Wait until next paint.
 * @returns {Promise<void>}
 */
function waitForNextPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

/**
 * Determine whether requisition list is enabled in store config.
 * @param {object | null} storeConfig
 * @returns {boolean}
 */
function isRequisitionListEnabled(storeConfig) {
  if (!storeConfig || typeof storeConfig !== 'object') return false;

  const listEnabled = isTruthyFlag(storeConfig.is_requisition_list_active);
  const companyEnabled = storeConfig.company_enabled === undefined
    ? true
    : isTruthyFlag(storeConfig.company_enabled);

  return listEnabled && companyEnabled;
}

/**
 * Execute staged refresh.
 * @param {HTMLElement} block
 * @param {object} config
 * @returns {Function}
 */
function createRefresh(block, config) {
  let refreshToken = 0;

  return async () => {
    const currentToken = refreshToken + 1;
    refreshToken = currentToken;

    if (!checkIsAuthenticated()) {
      renderGuest(block, config);
      return;
    }

    const state = createInitialState(config);
    state.permissions = getPermissionsSnapshot();
    renderAuthenticated(block, state);

    try {
      // Critical initializers only.
      await Promise.all([
        import('../../scripts/initializers/auth.js'),
        import('../../scripts/initializers/account.js'),
        import('../../scripts/initializers/company.js'),
      ]);

      if (refreshToken !== currentToken) return;
      if (!checkIsAuthenticated()) {
        renderGuest(block, config);
        return;
      }

      const [accountApi, companyApi] = await Promise.all([
        import('@dropins/storefront-account/api.js'),
        import('@dropins/storefront-company-management/api.js'),
      ]);

      const [customer, orderHistory, companyEnabled] = await Promise.all([
        safeRequest(() => accountApi.getCustomer()),
        safeRequest(() => accountApi.getOrderHistoryList(1, 'viewAll', 1)),
        safeRequest(() => companyApi.companyEnabled()),
      ]);

      if (refreshToken !== currentToken) return;

      state.customerName = getCustomerName(customer);
      state.orderCount = orderHistory?.totalCount;
      state.companyEnabled = Boolean(companyEnabled);

      if (state.companyEnabled) {
        const companyData = await safeRequest(() => companyApi.getCompany());
        if (companyData && typeof companyData === 'object') {
          state.hasCompany = true;
          state.companyName = companyData.name || '';
        }
      }

      state.permissions = getPermissionsSnapshot();
      state.quoteEnabled = canUsePermissionSet(state.permissions, QUOTE_PERMISSION_KEYS);
      state.quoteTemplateEnabled = canUsePermissionSet(state.permissions, TEMPLATE_PERMISSION_KEYS);
      state.isLoadingCritical = false;
      state.isLoadingTier2 = state.hasCompany;
      state.isLoadingTier3 = state.hasCompany && state.config.showModuleCards;
      renderAuthenticated(block, state);

      if (!state.hasCompany) {
        state.isLoadingTier2 = false;
        state.isLoadingTier3 = false;
        renderAuthenticated(block, state);
        return;
      }

      await waitForNextPaint();
      if (refreshToken !== currentToken) return;

      const [usersResponse, rolesResponse, creditEnabled] = await Promise.all([
        safeRequest(() => companyApi.getCompanyUsers({ pageSize: 1, currentPage: 1 })),
        safeRequest(() => companyApi.getCompanyRoles({ pageSize: 1, currentPage: 1 })),
        safeRequest(() => companyApi.checkCompanyCreditEnabled()),
      ]);

      if (refreshToken !== currentToken) return;

      state.usersCount = usersResponse?.totalCount;
      state.rolesCount = rolesResponse?.totalCount;
      state.companyCreditEnabled = creditEnabled?.creditEnabled === true;

      if (state.companyCreditEnabled) {
        const companyCredit = await safeRequest(() => companyApi.getCompanyCredit());
        const availableCredit = companyCredit?.credit?.available_credit;
        state.creditAvailable = availableCredit?.value;
        state.creditCurrency = availableCredit?.currency;
      }

      state.isLoadingTier2 = false;
      renderAuthenticated(block, state);

      if (!state.config.showModuleCards) {
        state.isLoadingTier3 = false;
        renderAuthenticated(block, state);
        return;
      }

      await waitForNextPaint();
      if (refreshToken !== currentToken) return;

      if (state.quoteEnabled || state.quoteTemplateEnabled) {
        await import('../../scripts/initializers/quote-management.js');
        const quoteApi = await import('@dropins/storefront-quote-management/api.js');

        const quoteRequests = [];

        if (state.quoteEnabled) {
          quoteRequests.push(
            safeRequest(() => quoteApi.negotiableQuotes({ pageSize: 1, currentPage: 1 }))
              .then((result) => {
                state.quoteCount = result?.totalCount;
              }),
          );
        }

        if (state.quoteTemplateEnabled) {
          quoteRequests.push(
            safeRequest(() => quoteApi.getQuoteTemplates({ pageSize: 1, currentPage: 1 }))
              .then((result) => {
                state.templateCount = result?.totalCount;
              }),
          );
        }

        await Promise.all(quoteRequests);
      }

      await import('../../scripts/initializers/requisition-list.js');
      const requisitionApi = await import('@dropins/storefront-requisition-list/api.js');
      const requisitionStoreConfig = await safeRequest(() => requisitionApi.getStoreConfig());

      state.requisitionEnabled = isRequisitionListEnabled(requisitionStoreConfig);
      if (state.requisitionEnabled) {
        const requisitionLists = await safeRequest(() => requisitionApi.getRequisitionLists(1, 1));
        if (Array.isArray(requisitionLists)) {
          state.requisitionCount = requisitionLists.length;
        }
      }

      if (refreshToken !== currentToken) return;

      state.isLoadingTier3 = false;
      renderAuthenticated(block, state);
    } catch (error) {
      console.error('commerce-account-hub: staged refresh failed', error);
      if (refreshToken !== currentToken) return;

      state.hasError = true;
      state.isLoadingCritical = false;
      state.isLoadingTier2 = false;
      state.isLoadingTier3 = false;
      renderAuthenticated(block, state);
    }
  };
}

/**
 * Cleanup listeners and observers.
 * @param {Array<{off?: Function}>} subscriptions
 * @param {MutationObserver | null} observer
 */
function cleanup(subscriptions, observer) {
  subscriptions.forEach((subscription) => {
    subscription?.off?.();
  });

  observer?.disconnect();
}

export default async function decorate(block) {
  const config = getConfig(block);

  const refresh = createRefresh(block, config);
  const subscriptions = [];

  subscriptions.push(events.on('authenticated', () => {
    refresh();
  }, { eager: true }));

  subscriptions.push(events.on('auth/permissions', () => {
    if (checkIsAuthenticated()) refresh();
  }, { eager: true }));

  subscriptions.push(events.on('companyContext/changed', () => {
    if (checkIsAuthenticated()) refresh();
  }, { eager: true }));

  await refresh();

  let disposed = false;

  const observer = new MutationObserver(() => {
    if (disposed) return;

    if (!document.body.contains(block)) {
      disposed = true;
      cleanup(subscriptions, observer);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
