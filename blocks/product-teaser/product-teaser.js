import { readBlockConfig } from '../../scripts/aem.js';
import {
  renderPrice,
  performCatalogServiceQuery,
  mapProductAcdl,
  encodeSkuForUrl,
} from './product-teaser-utils.js';
import { rootLink } from '../../scripts/commerce.js';

const productTeaserQuery = `query productTeaser($sku: String!) {
  products(skus: [$sku]) {
    sku
    urlKey
    name
    externalId
    addToCartAllowed
    __typename
    images(roles: []) {
      label
      url
    }
    ... on SimpleProductView {
      price {
        ...priceFields
      }
    }
    ... on ComplexProductView {
      priceRange {
        minimum {
          ...priceFields
        }
        maximum {
          ...priceFields
        }
      }
    }
  }
}
fragment priceFields on ProductViewPrice {
  regular {
    amount {
      currency
      value
    }
  }
  final {
    amount {
      currency
      value
    }
  }
}`;

function renderPlaceholder(config, block) {
  block.textContent = '';
  block.appendChild(document.createRange().createContextualFragment(`
    <div class="image">
      <div class="placeholder"></div>
    </div>
    <div class="details">
      <h1></h1>
      <div class="price"></div>
      <div class="actions">
        ${config['details-button'] ? '<a href="#" class="button primary disabled">Details</a>' : ''}
        ${config['cart-button'] ? '<button class="secondary" disabled>Add to Cart</button>' : ''}
      </div>
    </div>
  `));
}

/**
 * Check if a URL is an AEM Assets URL
 * AEM Assets URLs contain '/adobe/assets/' in the pathname
 */
function isAemAssetsUrl(url) {
  try {
    const parsedUrl = new URL(url, window.location);
    return parsedUrl.pathname.includes('/adobe/assets/');
  } catch {
    return false;
  }
}

/**
 * Render image for AEM Assets URLs using optimized delivery format
 * https://adobe-aem-assets-delivery-experimental.redoc.ly/
 */
function renderAemAssetsImage(product, imageUrl, label, size) {
  const { name } = product;

  // Extract assetId from the URL
  const urlParts = imageUrl.split('/');
  const assetId = urlParts[urlParts.length - 1];

  // Create base URL with proper structure
  const baseUrl = imageUrl.replace(`/${assetId}`, '');

  const createUrlForWidth = (url, w, format) => {
    const newUrl = new URL(url, window.location);

    // replace spaces with dashes
    const seoName = name.replace(' ', '-');
    newUrl.pathname = `${newUrl.pathname}/${assetId}/as/${seoName}.${format}`;
    newUrl.searchParams.set('width', w);
    newUrl.searchParams.set('quality', '95');
    newUrl.searchParams.delete('dpr');
    newUrl.searchParams.delete('bg-color');
    return newUrl.toString();
  };

  const createUrlForDpi = (url, w, format) => `${createUrlForWidth(url, w, format)} 1x, ${createUrlForWidth(url, w * 2, format)} 2x, ${createUrlForWidth(url, w * 3, format)} 3x`;

  // Use valid formats from the API
  const webpUrl = createUrlForDpi(baseUrl, size, 'webp');
  const jpgUrl = createUrlForDpi(baseUrl, size, 'jpg');

  return document.createRange().createContextualFragment(`<picture>
      <source srcset="${webpUrl}" />
      <source srcset="${jpgUrl}" />
      <img width="${size}" src="${createUrlForWidth(baseUrl, size, 'jpg')}" loading="eager" alt="${label}" />
    </picture>
  `);
}

/**
 * Render image for standard Commerce media URLs
 * Uses the URL directly without AEM Assets optimization
 */
function renderStandardImage(imageUrl, label, size) {
  // Ensure URL has protocol for img src
  const fullUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;

  return document.createRange().createContextualFragment(`<picture>
      <img width="${size}" src="${fullUrl}" loading="eager" alt="${label}" />
    </picture>
  `);
}

/**
 * Replaces the loading placeholder with an authoring-facing explanation.
 * Named so an SC can tell "this SKU isn't in the catalog yet" from "this block
 * is broken" — the two are indistinguishable when the placeholder just stays.
 * @param {HTMLElement} block
 * @param {string} sku the SKU that could not be resolved
 * @param {string} [reason] optional extra sentence
 */
function renderUnavailable(block, sku, reason) {
  block.textContent = '';
  const card = document.createElement('div');
  card.className = 'product-teaser-unavailable';
  const title = document.createElement('h3');
  title.textContent = 'Product unavailable';
  const body = document.createElement('p');
  body.textContent = sku
    ? `“${sku}” was not found in the Adobe Commerce catalog. ${reason || 'Check the SKU, or seed the catalog data for this demo.'}`
    : 'Add a product SKU to this block so it can load from Adobe Commerce.';
  card.append(title, body);
  block.appendChild(card);
}

/**
 * Returns a picture element for product images
 * Automatically detects AEM Assets URLs vs standard Commerce URLs
 * and renders appropriately for each type
 *
 * A product with no Catalog Service image role gets a neutral placeholder
 * rather than an exception: this runs after the block has been emptied, so
 * throwing here would leave a permanently blank teaser on the page.
 */
function renderImage(product, size = 250) {
  const [image] = product.images ?? [];
  if (!image?.url) {
    const placeholder = document.createElement('div');
    placeholder.className = 'image-placeholder';
    placeholder.setAttribute('role', 'img');
    placeholder.setAttribute('aria-label', product.name || 'Product image unavailable');
    return placeholder;
  }
  const { url: imageUrl, label } = image;

  // Detect URL type and render appropriately
  if (isAemAssetsUrl(imageUrl)) {
    return renderAemAssetsImage(product, imageUrl, label, size);
  }
  return renderStandardImage(imageUrl, label, size);
}

function renderProduct(product, config, block) {
  const {
    name, urlKey, sku, price, priceRange, addToCartAllowed, __typename,
  } = product;

  const currency = price?.final?.amount?.currency || priceRange?.minimum?.final?.amount?.currency;
  const priceFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  });

  block.textContent = '';

  // Determine Add to Cart button state
  let addToCartButtonHtml = '';
  // Fix: Always show Add to Cart button if config['cart-button'] is true, regardless of __typename
  if (config['cart-button']) {
    if (__typename === 'SimpleProductView' && addToCartAllowed) {
      addToCartButtonHtml = '<button class="add-to-cart secondary">Add to Cart</button>';
    } else if (__typename === 'SimpleProductView' && !addToCartAllowed) {
      addToCartButtonHtml = '<button class="add-to-cart secondary" disabled>Add to Cart</button>';
    } else {
      // For non-simple products, show disabled Add to Cart button
      addToCartButtonHtml = '<button class="add-to-cart secondary" disabled>Add to Cart</button>';
    }
  }

  const fragment = document.createRange().createContextualFragment(`
    <div class="image">
    </div>
    <div class="details">
      <h1>${name}</h1>
      <div class="price">${renderPrice(product, priceFormatter.format)}</div>
      <div class="actions">
        ${config['details-button'] ? `<a href="${rootLink(`/products/${urlKey}/${encodeSkuForUrl(sku)}`)}" class="button primary">Details</a>` : ''}
        ${addToCartButtonHtml}
      </div>
    </div>
  `);

  fragment.querySelector('.image').appendChild(renderImage(product, 250));

  const addToCartButton = fragment.querySelector('.add-to-cart');
  if (addToCartButton && !addToCartButton.disabled && __typename === 'SimpleProductView' && addToCartAllowed) {
    addToCartButton.addEventListener('click', async () => {
      const values = [{
        optionsUIDs: [],
        quantity: 1,
        sku: product.sku,
      }];
      const { addProductsToCart } = await import('@dropins/storefront-cart/api.js');
      window.adobeDataLayer.push({ productContext: mapProductAcdl(product) });
      console.debug('onAddToCart', values);
      addProductsToCart(values);
    });
  }

  block.appendChild(fragment);
}

export default async function decorate(block) {
  const config = readBlockConfig(block);

  // Fix: Normalize config values to booleans, including string 'true'
  config['details-button'] = config['details-button'] === true || config['details-button'] === 'true';
  config['cart-button'] = config['cart-button'] === true || config['cart-button'] === 'true';

  renderPlaceholder(config, block);

  let product;
  try {
    const response = await performCatalogServiceQuery(productTeaserQuery, { sku: config.sku });
    [product] = response?.products ?? [];
  } catch (error) {
    renderUnavailable(block, config.sku, 'The Adobe Commerce catalog could not be reached.');
    return;
  }

  // An unresolvable SKU must say so. Returning silently here left the grey
  // placeholder on the page forever, which reads as a broken block rather than
  // one waiting for its data — the likeliest state before a datapack is seeded.
  if (!product?.sku) {
    renderUnavailable(block, config.sku);
    return;
  }

  product.images = (product.images ?? []).map((image) => ({ ...image, url: image.url.replace(/^https?:/, '') }));

  renderProduct(product, config, block);
}
