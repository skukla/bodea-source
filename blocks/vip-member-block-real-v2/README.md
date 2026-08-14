# VIP Member Block Real V2

## Overview

`vip-member-block-real-v2` is a live-data VIP account block that keeps the premium member layout while replacing authored demo commerce values with runtime Adobe Commerce drop-in data.

The block is storefront-safe:

1. Guests see a sign-in state only.
2. Authenticated users see real purchase-order, quote, company-credit, and account-route data.
3. Visible CTAs always navigate to real site pages on this storefront, not placeholder anchors or external domains.

## Authoring

This block is a DA key-value block with a minimal authored surface:

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `eyebrow-text` | string | `Private Member Offers - Q1 2025` | Small label above the heading |
| `title` | richtext | `Your exclusive catalog access.` | Supports inline emphasis like `<em>` |
| `subtitle` | string | member copy | Supporting intro copy |
| `rows-limit` | number | `3` | Max live PO spotlight rows (`1..5`) |
| `guest-cta-label` | string | `Sign in` | Guest CTA label |
| `guest-cta-href` | string | `/customer/login` | Guest CTA destination |

## Runtime Data Sources

When the customer is authenticated, the block initializes and reads from:

1. `accountApi.getCustomer()`
2. `accountApi.getOrderHistoryList(10, 'viewAll', 1)`
3. `companyApi.companyEnabled()`
4. `companyApi.getCompany()` when company access is available
5. `companyApi.checkCompanyCreditEnabled()` and `companyApi.getCompanyCredit()` when company credit is enabled
6. `quoteApi.negotiableQuotes({ pageSize: 10, currentPage: 1 })` when quote access is granted
7. `purchaseOrderApi.getPurchaseOrders({ companyPurchaseOrders: true }, 10, 1)` when company PO access is granted
8. `purchaseOrderApi.getPurchaseOrders({}, 10, 1)` as the fallback PO source when customer PO access is granted

## Live Mapping

The block maps live data into the layout like this:

1. Header stats: available credit, company PO count, open quotes.
2. Featured card: newest accessible PO using the first real PO line item.
3. Middle module card: real account-module links only.
4. Spotlight list: recent PO lines with real product names and SKU values.
5. Account card: authenticated account details with real account, order, and address routes.
6. Footer strip: company facts such as admin, sales rep, and payment or shipping methods.

## Navigation

All visible CTAs link to real site destinations only:

1. `/customer/account`
2. `/customer/orders`
3. `/customer/address`
4. `/customer/purchase-orders`
5. `/customer/purchase-order-details?poRef=...`
6. `/customer/negotiable-quote`
7. `/customer/company`
8. `/customer/company/credit`
9. `/customer/requisition-lists`
10. product pages via `getProductLink(urlKey, sku)`

If a real destination cannot be derived for a specific live record, that CTA is downgraded to the closest real site page instead of a fake placeholder.
