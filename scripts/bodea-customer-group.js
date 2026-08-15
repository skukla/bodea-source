/*
 * Bodea customer-group Catalog Service context (additive module).
 *
 * Loaded via the Demo Builder brand-assets vendor point as a head
 * <script type="module">. Kept additive so no commerce.js patch is needed:
 * it drives the storefront's own CS_FETCH_GRAPHQL instance (exported at
 * boilerplate commerce.js:45) from the outside.
 *
 * Every visitor gets a group header — that is what makes customer-group
 * pricing demoable for guests too: signed-in users resolve their real group
 * UID via GraphQL; guests (or any failed/absent resolution) normalize to the
 * Commerce guest group `MA==` (base64 "0"), exactly as the upstream code
 * does. The UID is hashed (base64-decode → SHA-1 → hex, matching the
 * upstream algorithm byte-for-byte) into the `Magento-Customer-Group`
 * header and session-cached; auth changes re-resolve with force. Every path
 * no-ops safely when the query fails or the backend lacks the field.
 *
 * No hardcoded endpoints or tenant ids — the endpoint comes from the
 * storefront's own config via commerce.js.
 */
import { events } from '@dropins/tools/event-bus.js';
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
/**
 * Emitted AFTER the new group header and cache-buster are both applied, and
 * only when the group actually changed.
 *
 * Blocks that memoize catalog responses need to drop those results when the
 * shopper's group changes, or a signed-in buyer keeps seeing guest prices. They
 * cannot key off `authenticated` for that: this module's own handler is async,
 * so a listener that refetches on `authenticated` races the header update and
 * is liable to re-fetch with the OLD group. Listening here removes the race.
 *
 * Fire-and-forget by design — nothing is required to be listening, so the
 * storefront works the same with or without a consumer.
 */
const CUSTOMER_GROUP_CHANGED_EVENT = 'bodea/customer-group-changed';
// base64("0") — the Commerce guest group. Guests always send this header so
// guest-group catalog pricing works (upstream DEFAULT_GUEST_CUSTOMER_GROUP_UID).
const DEFAULT_GUEST_CUSTOMER_GROUP_UID = 'MA==';

let customerGroupUidPromise = null;

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

/**
 * Resolves the visitor's group (real for signed-in, guest `MA==` otherwise),
 * hashes it, and applies the Catalog Service header + cache-buster. Mirrors
 * the upstream refreshCatalogCustomerGroupHeader: `force` bypasses the
 * session cache (used on auth changes so sign-in/out re-resolves).
 * @param {{force?: boolean}} [options]
 */
async function refreshCustomerGroupHeader({ force = false } = {}) {
  // Captured before anything is stored, so the comparison at the end reflects
  // the group in force when this call started.
  const previousUid = getStoredCustomerGroupUid();
  const cachedUid = !force && previousUid;
  const customerGroupUid = cachedUid || await fetchCustomerGroupUid();
  const normalizedUid = customerGroupUid || DEFAULT_GUEST_CUSTOMER_GROUP_UID;
  const customerGroupHeader = await hashCustomerGroupUid(normalizedUid);

  if (!customerGroupHeader) {
    // Hash failure (malformed UID): fall back to headerless requests.
    storeCustomerGroupUid(null);
    CS_FETCH_GRAPHQL.removeFetchGraphQlHeader(CUSTOMER_GROUP_HEADER);
    await refreshCatalogServiceEndpoint();
    return;
  }

  storeCustomerGroupUid(normalizedUid);
  CS_FETCH_GRAPHQL.setFetchGraphQlHeader(CUSTOMER_GROUP_HEADER, customerGroupHeader);
  await refreshCatalogServiceEndpoint({ [CUSTOMER_GROUP_HEADER]: customerGroupHeader });

  // Announce only a real transition, and only once the header + endpoint are
  // both live. `previousUid` is null on a first load in a fresh session, which
  // is not a change — emitting there would make every page load look like a
  // group switch to consumers.
  if (previousUid && previousUid !== normalizedUid) {
    events.emit(CUSTOMER_GROUP_CHANGED_EVENT, { customerGroupUid: normalizedUid });
  }
}

async function onAuthChange() {
  try {
    // Force so sign-in/out re-resolves instead of reusing the cached group.
    await refreshCustomerGroupHeader({ force: true });
  } catch {
    // Never let customer-group context break the storefront.
  }
}

// Every load applies a group header (guest or real) so group pricing is
// always active; auth events re-resolve. `eager` replays a pre-registration
// auth event, and the initial call covers plain guest loads.
events.on('authenticated', onAuthChange, { eager: true });

refreshCustomerGroupHeader().catch(() => {
  // Never let customer-group context break the storefront.
});
