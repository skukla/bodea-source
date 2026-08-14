# Catalog Highlights Block

## Overview

The `catalog-highlights` block renders a section header and a responsive product-card grid for featured catalog items.
It is built for EDS document authoring with typed rows and supports variable product counts.

## DA.live Authoring Model

Author using an **8-column** table named `catalog-highlights`.

### Typed Rows

| Row Type (Col 1) | Col 2 | Col 3 | Col 4 | Col 5 | Col 6 | Col 7 | Col 8 |
|---|---|---|---|---|---|---|---|
| `header` | eyebrow | title | subtitle | browse-link | empty | empty | empty |
| `product` | image | badge-text | badge-style | product-name | sku-meta | price | product-link |

### Badge Style Values

- `new`
- `popular`
- `sale`
- `none`

Invalid values fall back to `none`.

## Behavior

- Reads rows in order and routes by row type (`header` or `product`).
- Ignores unknown row types.
- Uses sane default header values when no `header` row exists.
- Renders a neutral image placeholder when product image is missing.
- Renders non-clickable cards when product links are missing.

## Dependencies

None.
