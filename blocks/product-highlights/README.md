# Product Highlights Block

## Overview

The `product-highlights` block renders a section header and a responsive product
card grid from document-authored table rows.

## DA.live Authoring Model

Author with a 2-column table named `product-highlights`.

- Column A: label only (author hint)
- Column B: value used by the block

| Row | Label | Value |
|---|---|---|
| 0 | `section-tag` | Section eyebrow text |
| 1 | `title` | Rich text heading |
| 2 | `cta` | Authored link (for example `[Browse full catalog](/catalog)`) |
| 3+ | `product` | `emoji \| badge \| name \| sku/spec \| price \| url \| bgStart,bgEnd` |

## Product Row Contract

Pipe-delimited product fields:

1. `emoji` - Product icon or emoji
2. `badge` - Optional badge text (`New`, `Popular`, `Save ...`)
3. `name` - Product name
4. `sku/spec` - SKU or short product details
5. `price` - Numeric display value (currency symbol is added automatically)
6. `url` - Product detail link
7. `bgStart,bgEnd` - Optional comma-separated gradient colors

Example row:

`🖥️ | New | ProEdge X9 Server | SKU: PE-X9-2U-64G | 4,299 | /products/proedge-x9 | #f0f7f3,#e4f9ef`

## Behavior

- Badge style mapping:
  - `New` -> green badge
  - `Popular` -> coral badge
  - `Save ...` -> gold badge
- Cards are keyboard navigable when a URL is provided.
- Add button shows temporary success feedback.
- Card reveal animation uses `IntersectionObserver` with a fallback for older browsers.

## Files

- `blocks/product-highlights/product-highlights.js`
- `blocks/product-highlights/product-highlights.css`
- `blocks/product-highlights/_product-highlights.json`
