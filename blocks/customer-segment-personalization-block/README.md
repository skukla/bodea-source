# Customer Segment Personalization Block

## Overview

The `customer-segment-personalization-block` displays authored content only when the current shopper matches at least one authored Adobe Commerce customer segment.

It is a segment-only block. It does not support customer groups, cart rules, or `type`-based deduplication.

Content can be authored inline or loaded from a fragment path.

## Authoring Model

| Field | Purpose |
|-------|---------|
| `content` | Inline content rendered when no fragment is configured |
| `customerSegments` | Comma-separated list of raw Adobe Commerce customer segment IDs |
| `fragment` | Optional fragment path to load instead of inline content |

## Configuration Rules

### `customerSegments`

- Required.
- Provide a comma-separated list of raw Adobe Commerce customer segment IDs.
- Values are trimmed, empty entries are ignored, and each ID is base64-encoded before matching against runtime personalization data.
- Matching uses OR semantics. If any authored segment matches the runtime `segments` array, the block becomes visible.
- If no valid segment IDs are authored, the block remains hidden and logs a console warning.

### `fragment`

- Optional.
- When set, the block loads content from the fragment path using the fragment loader.
- When not set, the block uses the authored `content` row.
- If `customerSegments` is missing, the block skips fragment loading and stays hidden.

## Runtime Integration

| Source | Usage |
|--------|-------|
| `getPersonalizationData()` | Reads the runtime `segments` array |
| `personalization/updated` event | Triggers visibility refresh when personalization data changes |

The block hides itself immediately during decorate to avoid a flash of untargeted content.

## Visibility Logic

The block is visible only when:

1. At least one valid `customerSegments` value is authored.
2. The runtime personalization `segments` array contains at least one matching base64-encoded segment UID.

If either condition fails, the block stays hidden.

## Testing Checklist

- Verify inline content renders for a shopper with a matching segment.
- Verify fragment content renders for a shopper with a matching segment.
- Verify the block stays hidden for a shopper with no matching segments.
- Verify the block updates after `personalization/updated`.
- Verify missing `customerSegments` logs a warning and skips fragment loading.
