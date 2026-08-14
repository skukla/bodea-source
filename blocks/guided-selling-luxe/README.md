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

The JSON schema can define:

- `id`
- `version`
- `theme`
- `contactHref`
- `compareHref`
- `tieBreakerOrder[]`
- `hero`
- `questions[]`
- `questions[].answers[]`
- `questions[].answers[].weights`
- `personas[]`
- `personas[].collection`
- `crossCategoryModules[]`
- optional `media` objects on hero, questions, personas, and modules

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
