# Features Grid Block

## Overview

The `features-grid` block renders a section header and a responsive grid of feature cards. It supports multiple card variants (`featured`, `default`, `wide`) and uses an IntersectionObserver to reveal cards as they enter the viewport. Built for EDS document authoring with a 2-column table structure.

## DA.live Authoring Model

Author using a **2-column** table: Column A = field label, Column B = field value.

### Row Contract

| Row Type (Col A) | Col B |
|---|---|
| `section-tag` | Eyebrow text |
| `title` | Section heading |
| `subtitle` | Section description |
| `cta-label` | Primary CTA link label |
| `cta-url` | Primary CTA link URL |
| `card` | Pipe-separated card data (see below) |

### Card Format

Each `card` row uses pipe-separated values:

`variant | icon | tag | title | description | cta-label | cta-url | icon-bg(optional)`

- **variant**: `featured`, `default`, or `wide`
- **icon**: Short icon text (e.g. `*`, `+`, `!`, or emoji)
- **tag**: Card eyebrow text
- **title**: Card heading
- **description**: Card body copy
- **cta-label**: Link label
- **cta-url**: Link URL
- **icon-bg** (optional): `fi-green`, `fi-gold`, `fi-blue`, `fi-dark`

Invalid variants fall back to `default`.

## Behavior

- Reads rows in order; first 5 rows are header fields, remaining rows are cards.
- Uses `IntersectionObserver` to add `is-visible` when cards enter the viewport.
- Desktop: 3-column grid; `featured` and `wide` cards span 2 columns.
- Tablet (≤1100px): 2-column grid; wide cards span full width.
- Mobile (≤700px): 1-column stack.

## Dependencies

None.
