# Hero 5 Block

## Overview

The `hero-5` block renders a two-column enterprise hero with animated background layers,
CTA actions, a trust row, and a dashboard-style metrics card.

## DA.live Authoring Model

Author with a one-column table named `hero-5` and 15 rows.

| Row | Field | Expected Value |
|---|---|---|
| 0 | Eyebrow | Short upper label |
| 1 | Title | Supports inline `**strong**` and `~~del~~` styling |
| 2 | Subtitle | Supporting description |
| 3 | Primary CTA | Link |
| 4 | Secondary CTA | Link |
| 5 | Trust Text | Rich text |
| 6 | Badge Value | Example: `+18%` |
| 7 | Badge Label | Example: `Q1 Cost Savings` |
| 8 | Metric 1 | `value | label | delta` |
| 9 | Metric 2 | `value | label | delta` |
| 10 | Metric 3 | `value | label | delta` |
| 11 | Order 1 | `name | sub-label | amount` |
| 12 | Order 2 | `name | sub-label | amount` |
| 13 | Order 3 | `name | sub-label | amount` |
| 14 | Floating Notice | Status copy |

## Behavior

- Rows are read in order and transformed into a custom DOM structure.
- Title markup maps `strong` to green highlight and `del` to outline style.
- Metrics and order rows are parsed from pipe-delimited values.
- The right-side card includes a generated inline SVG sparkline.
- Decorative mesh/grid/orb layers are `aria-hidden`.

## Dependencies

None.
