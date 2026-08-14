# Commerce Account Hub Block

## Overview

The Commerce Account Hub block renders a staged, live-data summary dashboard for `/customer/account`.
It combines account, company, quote, template, and requisition-list signals while preserving route-based module pages.

## Integration

### Block Configuration

| Configuration Key | Type | Default | Description | Required |
| --- | --- | --- | --- | --- |
| `title` | string | `My Account Hub` | Header title shown above metrics and module cards | No |
| `rows-limit` | number | `3` | Maximum module-card rows (2 cards per row) when module cards are enabled | No |
| `show-orders` | boolean | `true` | Shows quick-link card to `/customer/orders` | No |
| `show-addresses` | boolean | `true` | Shows quick-link card to `/customer/address` | No |
| `show-module-cards` | boolean | `false` | Enables heavy B2B module summary calls (quotes/templates/requisition lists) | No |
| `guest-cta-label` | string | `Sign in` | CTA label for guest view | No |
| `guest-cta-href` | string | `/customer/login` | CTA href for guest view | No |

### Data Sources

Tiered fetching strategy:

1. **Tier 1 (critical):**
   - `getCustomer()`
   - `getOrderHistoryList(1, 'viewAll', 1)`
   - `companyEnabled()`
   - `getCompany()` (only when company is enabled)
2. **Tier 2 (deferred):**
   - `getCompanyUsers({ pageSize: 1, currentPage: 1 })`
   - `getCompanyRoles({ pageSize: 1, currentPage: 1 })`
   - `checkCompanyCreditEnabled()` and `getCompanyCredit()`
3. **Tier 3 (optional, only when `show-module-cards=true`):**
   - `negotiableQuotes({ pageSize: 1, currentPage: 1 })` when quote permission allows
   - `getQuoteTemplates({ pageSize: 1, currentPage: 1 })` when template permission allows
   - `getStoreConfig()` and `getRequisitionLists(1, 1)` for requisition-list status/count

### Feature and Permission Gates

- Company APIs are called only after `companyEnabled()` and successful `getCompany()`.
- Credit summary is called only when `checkCompanyCreditEnabled().creditEnabled === true`.
- Quote/template calls are permission-gated using `auth/permissions` payloads.
- Requisition-list calls are made only when store config reports it enabled.

### Behavior Patterns

- **Guest users:** Render safe CTA card and no private API calls.
- **Authenticated B2C users:** Show account/order summary only.
- **Authenticated B2B users:** Show staged company/B2B module insights with route links.
- **Session/race safety:** Refresh token drops stale responses when auth or company context changes.
- **Partial failures:** Failed requests degrade individual cards and do not blank the full hub.

### Events

#### Event Listeners

- `authenticated` → refreshes the hub data state.
- `auth/permissions` → refreshes permission-gated module visibility.
- `companyContext/changed` → refreshes data for the active company.

#### Cleanup

Subscriptions are cleaned up with a `MutationObserver` when the block is removed from the DOM.

### Security

- Dynamic content is rendered via DOM APIs and `textContent`.
- User/API-derived values are not interpolated into `innerHTML`.
