# Table Block

## Overview

The Table block builds an HTML `<table>` from block content. It supports an optional header row and recreates a table from document/sheet rows and cells.

## Configuration

- **Content**: Each block row becomes a table row; each cell in a row becomes a `<td>` or `<th>`.
- **Header**: By default the first row is treated as the header (`<thead>`). Add class `no-header` to the block to treat all rows as body.

## Integration

- No URL parameters or external APIs; structure is fully defined by authored content.
- Header cells get `scope="col"` for accessibility.

## Behavior

- Rows are iterated in order; first row goes to `<thead>` (unless `no-header`), rest to `<tbody>`.
- Cell HTML is preserved when building cells (no sanitization in block logic).

## Error Handling

- Empty rows or cells produce empty `<td>`/`<th>` elements; no special handling for malformed content.
