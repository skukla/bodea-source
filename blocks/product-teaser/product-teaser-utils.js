import { getHeaders } from '@dropins/tools/lib/aem/configs.js';
import {
  rootLink,
  commerceEndpointWithQueryParams,
} from '../../scripts/commerce.js';

/**
 * Reversible, lowercase-stable, Helix-path-safe SKU encoding for PDP URLs.
 * Keeps [a-z0-9-] literal; escapes every other UTF-8 byte (including _) as
 * _HH lowercase hex. MIRROR of demo-builder-vscode
 * src/features/eds/services/pdpUrlEncoding.ts — keep byte-for-byte identical
 * (see ADR-007). Clean SKUs encode unchanged; SKUs with spaces/punctuation
 * round-trip instead of breaking. Decode is modulo case — Helix lowercases
 * content-bus paths and Catalog Service SKU lookup is case-insensitive.
 */
export function encodeSkuForUrl(sku) {
  const bytes = new TextEncoder().encode(sku.toLowerCase());
  let out = '';
  // eslint-disable-next-line no-restricted-syntax
  for (const b of bytes) {
    const ch = String.fromCharCode(b);
    out += /[a-z0-9-]/.test(ch) ? ch : `_${b.toString(16).padStart(2, '0')}`;
  }
  return out;
}

export async function performCatalogServiceQuery(query, variables) {
  const headers = {
    ...getHeaders('cs'),
    'Content-Type': 'application/json',
  };

  const apiCall = await commerceEndpointWithQueryParams();
  apiCall.searchParams.append(
    'query',
    query.replace(/(?:\r\n|\r|\n|\t|[\s]{4})/g, ' ').replace(/\s\s+/g, ' '),
  );
  apiCall.searchParams.append(
    'variables',
    variables ? JSON.stringify(variables) : null,
  );

  const response = await fetch(apiCall, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    return null;
  }

  const queryResponse = await response.json();

  return queryResponse.data;
}

export function renderPrice(
  product,
  format,
  html = (strings, ...values) => strings.reduce(
    (result, string, i) => result + string + (values[i] || ''),
    '',
  ),
  Fragment = null,
) {
  // Simple product
  if (product.price) {
    const { regular, final } = product.price;
    if (regular.amount.value === final.amount.value) {
      return html`<span class="price-final"
        >${format(final.amount.value)}</span
      >`;
    }
    return html`<${Fragment}>
      <span class="price-regular">${format(
    regular.amount.value,
  )}</span> <span class="price-final">${format(final.amount.value)}</span>
    </${Fragment}>`;
  }

  // Complex product
  if (product.priceRange) {
    const { regular: regularMin, final: finalMin } = product.priceRange.minimum;
    const { final: finalMax } = product.priceRange.maximum;

    if (finalMin.amount.value !== finalMax.amount.value) {
      return html` <div class="price-range">
        ${finalMin.amount.value !== regularMin.amount.value
    ? html`<span class="price-regular"
              >${format(regularMin.amount.value)}</span
            >`
    : ''}
        <span class="price-from"
          >${format(finalMin.amount.value)} -
          ${format(finalMax.amount.value)}</span
        >
      </div>`;
    }

    if (finalMin.amount.value !== regularMin.amount.value) {
      return html`<${Fragment}>
      <span class="price-final">${format(finalMin.amount.value)} - ${format(
  regularMin.amount.value,
)}</span>
    </${Fragment}>`;
    }

    return html`<span class="price-final"
      >${format(finalMin.amount.value)}</span
    >`;
  }

  return null;
}

export function mapProductAcdl(product) {
  const regularPrice = product?.priceRange?.minimum?.regular?.amount.value
    || product?.price?.regular?.amount.value
    || 0;
  const specialPrice = product?.priceRange?.minimum?.final?.amount.value
    || product?.price?.final?.amount.value;
  // storefront-events-collector will use storefrontInstanceContext.storeViewCurrencyCode
  // if undefined, no default value is necessary.
  const currencyCode = product?.priceRange?.minimum?.final?.amount.currency
    || product?.price?.final?.amount.currency
    || undefined;
  const minimalPrice = product?.priceRange ? regularPrice : undefined;
  const maximalPrice = product?.priceRange
    ? product?.priceRange?.maximum?.regular?.amount.value
    : undefined;

  return {
    productId: parseInt(product.externalId, 10) || 0,
    name: product?.name,
    sku: product?.variantSku || product?.sku,
    topLevelSku: product?.sku,
    pricing: {
      regularPrice,
      minimalPrice,
      maximalPrice,
      specialPrice,
      currencyCode,
    },
    canonicalUrl: rootLink(`/products/${product.urlKey}/${encodeSkuForUrl(product.sku)}`),
    mainImageUrl: product?.images?.[0]?.url,
  };
}
