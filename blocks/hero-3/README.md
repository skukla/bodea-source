# Hero 3 Block

## Overview

Hero 3 is a split-layout parallax hero with a glassmorphic design system. It features a text column with staggered entrance animations and a media column with a main image, floating accent cards, and scroll-driven parallax layers.

## Integration

### Block Configuration

Content is authored as up to 9 rows (all optional except row 1):

| Row | Column 1 | Column 2 |
|-----|----------|----------|
| 1 | Urgency chip text | Eyebrow text |
| 2 | Headline (paragraphs; `<em>` = italic, `<strong>` = indent) | — |
| 3 | Subcopy text | — |
| 4 | CTA buttons (links) | — |
| 5 | Trust items (list with leading icon character) | — |
| 6 | Badge items (list with leading icon character) | — |
| 7 | Main image | Vertical rail text |
| 8 | Accent card 1 image | Accent card 1 label |
| 9 | Accent card 2 image | Accent card 2 label |

### Dependencies

- `../../scripts/aem.js` — `createOptimizedPicture`

## Behavior Patterns

### Layout Behavior

- **Desktop**: 58/42 grid split between text and media columns, max-width 1280px
- **Mobile (768px-)**: Single column; media stacks above text, second accent card hidden, vertical rail hidden
- Full-bleed section: Container and wrapper max-width constraints are removed

### Parallax System

Three layers move at different scroll speeds:
- **Background layer** (0.12x) — Ambient depth
- **Media layer** (0.32x) — Main image
- **Decor layer** (0.52x) — Floating accent cards

### Entrance Animations

- All `.hero-3-stagger` elements fade in and slide up with sequential delays
- Main image scales from 97% with a 1-second transition
- Accent cards rotate in from offset positions with staggered delays (700ms, 880ms)
- Animations are triggered by adding the `hero-3-entered` class after a 60ms `requestAnimationFrame` delay

### Visual Details

- **Urgency chip**: Pill-shaped with pulsing dot animation and accent border
- **Headline**: Gradient text fill (accent-1 to accent-2 to neutral-900)
- **CTAs**: Primary uses gradient background with arrow animation; secondary uses glassmorphic border style
- **Accent cards**: Floating glassmorphic cards with gentle bobbing animations (5s/6s cycles)
- **Color slab**: Blurred gradient shape behind the media column for ambient color

### Error Handling

- Missing rows: Each element is conditionally rendered only if its data exists
- No content rows: Logs a warning and returns early
- `prefers-reduced-motion`: All entrance animations, floating card animations, and parallax are disabled
