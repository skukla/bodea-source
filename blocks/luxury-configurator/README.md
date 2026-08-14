# Luxury Configurator

## Overview

`luxury-configurator` is a standalone premium configuration block for a single Adobe Commerce parent product.

It is designed for configurable products where the storefront already exposes live option data such as:

1. color or image swatches,
2. text chip attributes,
3. dropdown attributes,
4. variant SKU, pricing, stock, and gallery changes.

The block keeps the repo's luxury visual language while reusing the storefront PDP option engine under the hood.

## What It Reuses

The block relies on the existing Adobe Commerce PDP client state already present in this repo:

1. `fetchProductData()` for initial product and refined variant data,
2. `initialize()` for scoped PDP state,
3. `setProductConfigurationValues()` and `getProductConfigurationValues()` for option and quantity changes,
4. `isProductConfigurationValid()` for required-option gating,
5. `persistURLParams: true` so `optionsUIDs` remain shareable in the page URL.

## Authoring Model

Author as a DA key-value block.

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `sku` | string |  | Parent configurable product SKU. Required. |
| `title` | string | `Bespoke Configuration Studio` | Main luxury heading |
| `eyebrow` | string | `Private Configuration Studio` | Overline / label above the heading |
| `description` | string | default copy | Supporting editorial copy |
| `theme` | string | `obsidian` | `obsidian`, `emerald`, `ivory` |
| `layout` | string | `split-editorial` | `split-editorial`, `stacked-gallery` |
| `show-summary` | boolean | `true` | Show selected attribute recap |
| `show-price` | boolean | `true` | Show live price surface |
| `show-gallery` | boolean | `true` | Show lead image preview |
| `show-spec-highlights` | boolean | `true` | Show first four product attributes |
| `attribute-groups` | string | sample value | Optional authored grouping by option label |
| `cta-label` | string | `Add configured product to cart` | Primary action copy |
| `pdp-link-label` | string | `View full details` | Secondary link to the full PDP |
| `concierge-label` | string | `Book concierge` | Secondary support CTA |
| `concierge-href` | string | `/support` | Safe support destination |

## Attribute Group Format

Use a semicolon-separated list of group labels, followed by a colon and comma-separated option labels:

```text
Materials: Material, Finish; Signature: Hardware, Scale
```

Matching is done against the visible Commerce option labels after normalization.

Any ungrouped attributes fall back to `Configuration`.

## Behavior

1. The block loads the parent SKU from Adobe Commerce.
2. A hidden PDP options container handles live refinement and validity updates.
3. The visible UI renders custom luxury controls from the Commerce option model.
4. Selection changes update the current variant, SKU, image, price, and availability.
5. Add to cart uses the same product configuration payload shape as the storefront PDP.

## Supported Option Shapes

The first version is optimized for single-select configurable-product attributes.

Supported:

1. `text`
2. `image`
3. `color`
4. `dropdown`

Constraint:

1. Multi-select Commerce attributes are not the target for this block's first release.

## Copy-Paste Table

Use [`luxury-configurator-table.txt`](luxury-configurator-table.txt) for a starter DA block.

## Security Notes

1. The block builds visible UI with DOM APIs instead of injecting authored or Commerce HTML.
2. Support links are protocol-allowlisted before rendering.
3. Product descriptions are rendered as plain text in the visible shell.
