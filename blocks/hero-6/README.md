# Hero 6 Block

## Overview

The `hero-6` block (Chronicle Bento Hero) renders a bento-style hero with four cells: copy, platform metrics, feature highlights, and a decorative orbital SVG animation. It supports eyebrow labels, styled headlines (bold → accent green, italic → outline stroke), CTAs, stats with count-up animation, and feature rows.

## DA.live Authoring Model

Author with a one-column table named `hero-6` and 11 rows.

| Row | Field | Expected Value |
|---|---|---|
| 0 | Eyebrow | Short upper label |
| 1 | Headline | Rich text; `**bold**` → green accent, `*italic*` → outline stroke |
| 2 | Subtitle | Supporting description |
| 3 | Primary CTA | Link |
| 4 | Secondary CTA | Link |
| 5 | Stat 1 | `value \| label \| note` (pipe-delimited) |
| 6 | Stat 2 | `value \| label \| note` |
| 7 | Stat 3 | `value \| label \| note` |
| 8 | Feature 1 | `icon \| title \| description` (emoji or symbol, pipe-delimited) |
| 9 | Feature 2 | `icon \| title \| description` |
| 10 | Feature 3 | `icon \| title \| description` |

## Configuration Options

No block configuration is read via `readBlockConfig()`. All content is authored in the block table.

## Integration

### URL Parameters

None.

### Local Storage

None.

### Events

None. The block is purely presentational.

## Behavior Patterns

- **Headline styling**: `<strong>` / `<b>` maps to `.h6-headline-accent` (green); `<em>` / `<i>` maps to `.h6-headline-outline` (stroke text).
- **Stats**: Numbers animate from zero to target when the stats cell enters the viewport (IntersectionObserver, 0.5 threshold).
- **Orbital visual**: Purely decorative SVG with elliptical orbit rings, floating nodes, and a central sphere. `aria-hidden` and `role="presentation"`.
- **Bento grid**: Four cells—copy, stats, features, visual—assembled in a bento layout.

## Error Handling

- Empty or missing rows are handled gracefully; optional elements (eyebrow, subtitle, secondary CTA, stat notes, feature descriptions) are omitted when absent.
- Stat count-up uses `data-target` for the numeric value; non-numeric suffixes are preserved.

## Files

- `hero-6.js` - Block decorator, orbital SVG builder, count-up logic
- `hero-6.css` - Bento layout and visual styles
- `_hero-6.json` - DA.live model and field definitions
