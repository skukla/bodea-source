# Quote Block

## Overview

The Quote block renders a quotation and optional attribution. It turns authored content into a semantic `<blockquote>` with styled quotation and attribution sections.

## Configuration

- **Content**: First row = quotation text; second row (optional) = attribution (e.g. author/source).
- **Attribution markup**: `<em>` inside the attribution row is converted to `<cite>` for semantics.

## Integration

- No URL parameters or localStorage; content is fully authored in the document/sheet.
- Decoration is synchronous: block children are mapped to quotation and attribution, then replaced by the styled blockquote.

## Behavior

- Quotation gets class `quote-quotation`, attribution gets `quote-attribution`.
- Empty or missing attribution is allowed; only the quotation is required.

## Error Handling

- Missing second row results in quotation-only output with no attribution element.
