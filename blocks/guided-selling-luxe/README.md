# Guided Selling Luxe

## Overview

`guided-selling-luxe` is the flagship Bodea guided-selling advisor for server racks,
network enclosures, and adjacent infrastructure categories.

It is schema-driven, persona-scored, and visually premium by default:

- cinematic intro state
- 5-step guided decision flow
- weighted persona scoring with tie-break rules
- inline ranked results
- live product hydration via the product-discovery `search()` API

## Authoring

The block uses a DA key-value model.

| Key | Required | Default | Description |
| --- | --- | --- | --- |
| `schema-url` | Yes | `/data/guided-selling/bodea-rack-finder.json` | Relative JSON schema path for hero copy, questions, personas, and result modules |
| `eyebrow-text` | No | `Bodea Rack Finder` | Small label used while the experience is loading or when schema hero copy omits an eyebrow |
| `title` | No | built-in title | Loading/fallback title |
| `subtitle` | No | built-in subtitle | Loading/fallback subtitle |
| `primary-cta-label` | No | `Start the rack finder` | Loading/fallback primary CTA label |
| `secondary-cta-label` | No | `Talk to a Bodea specialist` | Loading/fallback secondary CTA label |
| `secondary-cta-href` | No | `/contact` | Loading/fallback consult destination |
| `theme` | No | `emerald` | Accent palette (`emerald`, `gold`) |

## Schema Contract

**Required.** `rankPersonas` dereferences these directly, so the block throws at the
results step without them:

- `personaOrder[]` — persona ids, in scoring order; `answers[].weights` keys are looked
  up against this list. **Every persona in `personas[]` must appear here**, or scoring
  throws on the one that is missing (measured: dropping an id gives
  `TypeError: Cannot read properties of undefined (reading 'total')`). A surplus id that
  has no matching persona is harmless.
- `personas[]` and `personas[].collection`
- `questions[]`, `questions[].answers[]`, `questions[].answers[].weights`
- `tieBreakerOrder[]` — question ids, consulted in order when totals tie

Optional:

- `id`, `version`, `theme`, `contactHref`, `compareHref`, `hero`
- `crossCategoryModules[]`
- `media` objects on hero, questions, personas, and modules

### Product hydration

`collection.search` and each cross-category module accept `categoryPath[]` and/or
`skus[]`. Both are matched against Adobe Commerce natively — `categoryPath` takes the
**full** path (`products/racks`, not `racks`), and a `visibility` filter is always
appended. Point these at categories that actually exist, or the result tiles render
empty: the block cannot tell a wrong path from an empty one.

## Runtime Behavior

1. Loads the linked schema file.
2. Restores session state from `sessionStorage` when available.
3. Scores all chosen answers against fixed personas.
4. Breaks ties using the configured question order, then persona schema order.
5. Renders a hero collection, two alternates, and adjacent category modules.
6. Hydrates live product cards for result modules using `search()` with a non-PLP scope.

## Analytics

The block emits these events when data layers are present:

- `quiz_start`
- `quiz_step_view`
- `quiz_answer_select`
- `quiz_complete`
- `quiz_result_view`
- `quiz_result_click`
- `quiz_restart`

Each payload includes `persona_id`, `persona_rankings`, and `collection_targets`.
