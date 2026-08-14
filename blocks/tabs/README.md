# Tabs Block

## Overview

The Tabs block organizes content into tabbed panels using ARIA-compliant `role="tablist"`, `role="tab"`, and `role="tabpanel"` attributes. The first tab is selected by default and panels are shown/hidden via `aria-hidden`.

## Integration

### Block Configuration

Each child row of the block becomes a tab panel. The first cell of each row is extracted as the tab button label; the remaining content forms the panel body.

### Content Model (`_tabs.json`)

Standard EDS block definition — no special field configuration required.

## Behavior Patterns

### Layout Behavior

- **Tab list**: Horizontal flex row with pill-shaped buttons inside a glassmorphic container with rounded corners
- **Tab panels**: Glassmorphic cards with blur, border, and purple-tinted shadow; gradient shimmer top edge
- Font size scales responsively: `xs` on mobile, `s` at 600px+, `m` at 900px+
- Tab list scrolls horizontally on overflow

### User Interaction Flows

1. Block renders with the first tab selected and its panel visible
2. Clicking a tab button hides all panels, deselects all tabs, then shows the clicked panel
3. Tab IDs are derived from the tab label text via `toClassName()` for URL-friendly identifiers

### Accessibility

- Tab buttons use `role="tab"` with `aria-selected` and `aria-controls`
- Panels use `role="tabpanel"` with `aria-hidden` and `aria-labelledby`
- Hidden panels are set to `display: none` via CSS

### Visual Details

- **Inactive tab**: Transparent background, neutral text; hover shows light purple tint
- **Active tab**: White glassmorphic background with purple text, inset glow, and elevated shadow
- **Panel**: Semi-transparent white with blur, border, and layered shadow

### Error Handling

- Empty tab labels produce buttons with no visible text but still function
- Single-tab blocks render normally with one visible panel
