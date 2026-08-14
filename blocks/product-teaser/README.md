# Product Teaser Block

## Overview

The Product Teaser block displays a single product card with image, name, price, and action buttons. It fetches live product data from the Adobe Commerce Catalog Service GraphQL API using a configured SKU, and supports both AEM Assets and standard Commerce image URLs.

## Integration

### Block Configuration

Configured via `readBlockConfig` with these keys:
- **sku** (required) — The product SKU to fetch
- **details-button** (`true`/`false`) — Show a "Details" link to the PDP
- **cart-button** (`true`/`false`) — Show an "Add to Cart" button

### Dependencies

- `../../scripts/aem.js` — `readBlockConfig`
- `./product-teaser-utils.js` — `renderPrice`, `performCatalogServiceQuery`, `mapProductAcdl`
- `../../scripts/commerce.js` — `rootLink`, `encodeSkuForUrl`
- `@dropins/storefront-cart/api.js` — `addProductsToCart` (lazy-loaded on click)

### Events

- **Add to Cart**: Pushes `productContext` to `window.adobeDataLayer` before calling `addProductsToCart`

## Behavior Patterns

### Layout Behavior

- **Mobile**: Stacks image above details in a vertical flex layout
- **Desktop (600px+)**: Side-by-side with image at 40% width and details flex-filling the rest
- Dark glassmorphic card with purple-tinted shadow and gradient top shimmer

### User Interaction Flows

1. Block renders a skeleton placeholder immediately
2. GraphQL query fetches product data by SKU
3. Product image, name, price, and action buttons replace the placeholder
4. "Details" button links to `/products/{urlKey}/{encodedSku}`
5. "Add to Cart" is enabled only for `SimpleProductView` with `addToCartAllowed === true`; disabled for complex products

### Image Rendering

- **AEM Assets URLs** (containing `/adobe/assets/`): Rendered with optimized delivery using WebP/JPG srcset at 1x/2x/3x DPI
- **Standard Commerce URLs**: Rendered directly with protocol normalization

### Error Handling

- If the API returns no products or an empty SKU, the block keeps the placeholder and returns early
- Add to Cart button is disabled when `addToCartAllowed` is false or the product is a complex type
- Image URLs starting with `//` are prefixed with `https:`
