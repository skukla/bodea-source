# Live Block

## Overview

`live-block` renders a portable authenticated commerce dashboard with account-scoped KPIs, labeled charts, and activity panels.

The block remains storefront-safe:

1. Guests see a sign-in CTA only.
2. Authenticated users get real commerce data from drop-in storefront APIs.
3. Source failures are isolated so one API failure does not blank the full block.

## Configuration

Configured as a DA key-value block.

| Key | Type | Default | Description |
|---|---|---|---|
| `title` | string | `Live Commerce Dashboard` | Dashboard heading |
| `guest-cta-label` | string | `Sign in` | Guest state CTA label |
| `guest-cta-href` | string | `/customer/login` | Guest state CTA href |
| `rows-limit` | number | `3` | Activity rows per panel (`1..5`) |
| `show-sparkline` | boolean | `true` | Shows compact order sparkline |
| `order-window-days` | number | `90` | Window for windowed order KPIs (`30..365`) |
| `trend-points` | number | `12` | Max points per trend chart (`6..24`) |
| `show-finance-section` | boolean | `true` | Enables finance KPI/activity section |
| `show-operations-section` | boolean | `true` | Enables operations KPI/activity section |
| `show-sourcing-section` | boolean | `true` | Enables sourcing KPI/activity section |
| `show-charts` | boolean | `true` | Enables detailed chart section |
| `show-last-updated` | boolean | `true` | Shows last updated timestamp in header |
| `refresh-label` | string | `Refresh data` | Label for manual refresh button |

## Data Sources

The block lazy-initializes only the drop-ins required by enabled sections.

Core account/B2B requests:

1. `getOrderHistoryList(50, 'viewAll', 1)`
2. `getCompanyCredit()`
3. `getCompanyCreditHistory({ pageSize, currentPage: 1 })`
4. `getPurchaseOrders({}, 50, 1)`
5. `getPurchaseOrders({ myApprovals: true }, 50, 1)`
6. `getPurchaseOrders({ companyPurchaseOrders: true }, 50, 1)`

Extended requests (enabled by section flags):

1. `getCartData()`
2. `getCompanyUsers({ pageSize: 100, currentPage: 1 })`
3. `negotiableQuotes({ pageSize: 50, currentPage: 1 })`
4. `getQuoteTemplates({ pageSize: 50, currentPage: 1 })`
5. `getRequisitionLists(1, 50)`
6. `getWishlists()`

## KPI + Charts

KPIs include credit, orders, approvals/PO, cart, team, quotes, requisition lists, and wishlist volumes.

Charts include:

1. Order value trend (line)
2. PO status breakdown (bar)
3. Credit timeline (line)
4. Team status split (donut)
5. Quote pipeline (stacked status bar)

Currency-sensitive aggregates (window spend, AOV, PO pipeline) only render totals when source currency is consistent; mixed currencies render `Mixed currency`.

## Refresh Behavior

Refresh happens on:

1. Initial block load
2. `authenticated`
3. `purchase-order/refresh`
4. Manual refresh button

When sourcing is enabled, it also refreshes on:

1. `cart/data`
2. `quote-management/negotiable-quote-requested`
3. `quote-management/quote-duplicated`
4. `quote-management/quote-template-generated`
5. `wishlist/alert`

No polling is used.
