# Search Block

## Overview

The Search block provides a content search experience that queries a JSON index and displays results in a responsive card grid. It supports URL-driven search state, term highlighting, and a minimal variant for compact layouts.

## Integration

### Block Configuration

- The block looks for an `<a>` link in its content to use as the data source; defaults to `/query-index.json`
- Placeholders are loaded via `fetchPlaceholders()` for localized strings

### URL Parameters

- **q** — The search query string. Pre-populates the input and triggers a search on load. Updated in the URL via `history.replaceState` as the user types.

### Dependencies

- `../../scripts/aem.js` — `createOptimizedPicture`, `decorateIcons`
- `../../scripts/commerce.js` — `fetchPlaceholders`

## Behavior Patterns

### Layout Behavior

- **Search box**: Grid layout with icon + input; glassmorphic input field with focus ring
- **Results (default)**: Auto-fill grid with minimum 278px card width; glassmorphic cards with hover lift
- **Results (minimal variant)**: Simple list layout with small circular thumbnails positioned to the left

### User Interaction Flows

1. User types in the search input (minimum 3 characters to trigger)
2. Data is fetched from the configured JSON source
3. Results are filtered by matching terms in title/header first, then description/path
4. Matching terms are highlighted with `<mark>` elements
5. Pressing Escape clears the search and resets the URL
6. On page load, if `?q=` is present, the search auto-executes

### Visual Variants

- **Default**: Card grid with images, titles, and descriptions in glassmorphic cards
- **Minimal** (`.search.minimal`): Compact list with inline thumbnails and accent-colored title links

### Error Handling

- Empty or failed API responses are logged to console; no results are shown
- Searches under 3 characters clear the results area
- No-results state displays a configurable placeholder message
