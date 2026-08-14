/*
 * Bodea customer-group Catalog Service context (additive module).
 *
 * Loaded via the Demo Builder brand-assets vendor point as a head
 * <script type="module">. Kept additive so no commerce.js patch is needed:
 * it drives the storefront's own CS_FETCH_GRAPHQL instance (exported at
 * boilerplate commerce.js:45) from the outside.
 *
 * On sign-in (and on initial load when already authenticated) it fetches the
 * customer group UID, hashes it (base64-decode → SHA-1 → hex, matching the
 * upstream algorithm byte-for-byte), sets the `Magento-Customer-Group` header
 * on Catalog Service requests, and session-caches the UID. On sign-out it
 * clears the header and cache. Every path no-ops safely when the user is not
 * authenticated, the query fails, or the backend lacks the field.
 *
 * No hardcoded endpoints or tenant ids — the endpoint comes from the
 * storefront's own config via commerce.js.
 */
import { events } from '@dropins/tools/event-bus.js';
import { getCookie } from '@dropins/tools/lib.js';
import {
  CS_FETCH_GRAPHQL,
  commerceEndpointWithQueryParams,
  // Root-absolute so this module resolves the SAME commerce.js instance the
  // storefront loads from head.html, wherever this file is vendored from.
  // eslint-disable-next-line import/no-unresolved, import/no-absolute-path
} from '/scripts/commerce.js';

const CUSTOMER_GROUP_UID_QUERY = `
  query customerGroupContext {
    customerGroup {
      uid
    }
  }
`;

const CUSTOMER_GROUP_UID_SESSION_KEY = 'DROPINS_CUSTOMER_GROUP_UID';
const CUSTOMER_GROUP_HEADER = 'Magento-Customer-Group';
const AUTH_COOKIE = 'auth_dropin_user_token';

let customerGroupUidPromise = null;
let headerApplied = false;

/**
 * Hashes a Commerce customer group UID the way the backend expects:
 * base64-decode the UID to bytes, SHA-1 digest, lowercase hex.
 * Returns null (never throws) when the UID is missing or malformed.
 * @param {string} customerGroupUid base64-encoded customer group UID
 * @returns {Promise<string|null>} hex digest, or null
 */
async function hashCustomerGroupUid(customerGroupUid) {
  if (!customerGroupUid) return null;

  try {
    const decodedUid = Uint8Array.from(atob(customerGroupUid), (char) => char.charCodeAt(0));
    const digest = await crypto.subtle.digest('SHA-1', decodedUid);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

function getStoredCustomerGroupUid() {
  try {
    return window.sessionStorage.getItem(CUSTOMER_GROUP_UID_SESSION_KEY);
  } catch {
    return null;
  }
}

function storeCustomerGroupUid(customerGroupUid) {
  try {
    if (customerGroupUid) {
      window.sessionStorage.setItem(CUSTOMER_GROUP_UID_SESSION_KEY, customerGroupUid);
    } else {
      window.sessionStorage.removeItem(CUSTOMER_GROUP_UID_SESSION_KEY);
    }
  } catch {
    // Session storage unavailable — runtime headers still work for this page.
  }
}

/**
 * Refreshes the Catalog Service endpoint's cache-buster query param so CDN
 * caching keys on the current header set. Failure is non-fatal: the header on
 * the fetch instance is already correct.
 * @param {Object} customHeaders headers to include in the cache-buster hash
 */
async function refreshCatalogServiceEndpoint(customHeaders = {}) {
  try {
    CS_FETCH_GRAPHQL.setEndpoint(await commerceEndpointWithQueryParams(customHeaders));
  } catch {
    // Config not ready or endpoint unset — keep the current endpoint.
  }
}

/**
 * Fetches the signed-in customer's group UID from the storefront's own
 * Catalog Service GraphQL instance. Resolves to null (never rejects) on
 * errors or when the backend lacks the customerGroup field.
 * @returns {Promise<string|null>}
 */
function fetchCustomerGroupUid() {
  if (customerGroupUidPromise) return customerGroupUidPromise;

  customerGroupUidPromise = CS_FETCH_GRAPHQL.fetchGraphQl(CUSTOMER_GROUP_UID_QUERY, {
    method: 'GET',
  })
    .then(({ data, errors }) => {
      if (errors?.length) return null;
      return data?.customerGroup?.uid || null;
    })
    .catch(() => null)
    .finally(() => {
      customerGroupUidPromise = null;
    });

  return customerGroupUidPromise;
}

async function applyCustomerGroupHeader() {
  const customerGroupUid = getStoredCustomerGroupUid() || await fetchCustomerGroupUid();
  const customerGroupHeader = await hashCustomerGroupUid(customerGroupUid);
  if (!customerGroupHeader) return;

  storeCustomerGroupUid(customerGroupUid);
  CS_FETCH_GRAPHQL.setFetchGraphQlHeader(CUSTOMER_GROUP_HEADER, customerGroupHeader);
  await refreshCatalogServiceEndpoint({ [CUSTOMER_GROUP_HEADER]: customerGroupHeader });
  headerApplied = true;
}

async function clearCustomerGroupHeader() {
  storeCustomerGroupUid(null);
  if (!headerApplied) return;

  CS_FETCH_GRAPHQL.removeFetchGraphQlHeader(CUSTOMER_GROUP_HEADER);
  await refreshCatalogServiceEndpoint();
  headerApplied = false;
}

async function onAuthChange(authenticated) {
  try {
    if (authenticated) {
      await applyCustomerGroupHeader();
    } else {
      await clearCustomerGroupHeader();
    }
  } catch {
    // Never let customer-group context break the storefront.
  }
}

// Auth wiring: `eager` replays the last emitted auth state; the cookie check
// covers already-authenticated first loads where the event has not fired yet.
events.on('authenticated', onAuthChange, { eager: true });

if (events.lastPayload('authenticated') === undefined && getCookie(AUTH_COOKIE)) {
  onAuthChange(true);
}
