# Quiz Router Block

## Overview

The `quiz-router` block is a guided "find your perfect product" wizard that routes users to PLP (Product Listing Page), PDP (Product Detail Page), or a fragment based on authored question rows with option labels and destination URLs.

It uses **typed row authoring** in DA.live:
- `question` rows for each wizard step,
- `option` rows for selectable choices with destination URLs.

## DA.live Integration and Authoring Structure

Author using a **3-column** `quiz-router` table.

### Typed Row Model

| Row Type (Col 1) | Col 2 | Col 3 |
|-----------------|-------|-------|
| `question` | Question text (rich text) | Optional image/media |
| `option` | Option label (supports presentation microformat) | Destination URL (PLP, PDP, or fragment path) |

- **question** rows define each step; options that follow belong to the preceding question.
- **option** rows: Col 2 = label, Col 3 = link or URL (supports authored `a[href]`, `Label|URL`, or `Title || Subtitle || Badge || Icon` in Col 2).
- Use `#next` or leave URL empty to advance to the next question instead of routing.
- Destination URLs: relative paths for PLP/PDP/fragments (e.g. `/products/shirts`, `/product/abc123`, `/fragments/recommendations`).

### Option Presentation Microformat (Optional)

Use `||` segments in the option label cell for richer tile content:

```text
Title || Subtitle || Badge || Icon
```

Examples:
- `Small server room || 7-24U growth-ready footprint || Popular || 🧰`
- `Industrial edge || Ruggedized & dust-aware || Warehouse || 🏭`
- `Open office / retail || Quiet, customer-adjacent installs`

Notes:
- All segments are optional after `Title`.
- Existing `Label|URL` shorthand remains supported.
- If Col 3 has a URL, it takes precedence over any URL shorthand in Col 2.

### Authoring Examples

| Col 1 | Col 2 | Col 3 |
|-------|-------|-------|
| `question` | What type of product are you looking for? | [optional image] |
| `option` | Shirts | /products/shirts |
| `option` | Hats | /products/hats |
| `option` | Best sellers | /fragments/best-sellers |
| `question` | What's your budget? | |
| `option` | Under $50 | /products/under-50 |
| `option` | $50–$100 | /products/mid-range |
| `option` | Premium | /products/premium |

## Configuration Options

### Section Metadata Reference

Place section metadata immediately above the block. Page metadata (meta tags) can also be used as fallback.

| Key | Possible Values | Default | Effect |
|-----|-----------------|---------|--------|
| `quizrouter-progress` | `true`, `false` | `true` | Show step progress (e.g. "Step 2 of 4") |
| `quizrouter-theme` | `default`, `compact`, `card`, `premium` | `default` | Visual style variant |
| `quizrouter-result-mode` | `navigate`, `fragment` | `navigate` | On final selection: full navigation vs load fragment inline |

### Metadata Precedence

1. Section metadata (from `section-metadata` block above quiz-router)
2. Page metadata (from `<meta name="quizrouter-*">` tags)
3. Block defaults (`progress=true`, `theme=default`, `result-mode=navigate`)

## Behavior Patterns

### Routing

- **navigate** (default): Selecting an option with a URL navigates to that URL (PLP, PDP, or any page).
- **fragment**: When the destination is a fragment path (e.g. `/fragments/best-sellers`), the fragment is loaded inline and replaces the block instead of navigating.
- If fragment loading fails, quiz-router falls back to full-page navigation for the same destination.

### Multi-Step Flow

- Options with `#next` or empty URL advance to the next question.
- Options with a valid URL route immediately (or load fragment when `quizrouter-result-mode` is `fragment`).
- `#next` on the final question is a no-op (safe warning in console).
- In `premium` theme, users get Back/Restart controls and clickable visited step pills.
- Selected answers persist when revisiting previous steps.

### URL Safety Rules

Quiz destination URLs are sanitized with a same-origin policy:

- Allowed: relative/hash/query (`/path`, `./path`, `../path`, `#anchor`, `?q=x`)
- Allowed: absolute `http/https` URLs that resolve to the current origin
- Blocked: `javascript:` URLs, protocol-relative URLs (`//example.com`), and off-origin absolute URLs

When a destination is blocked and no explicit `#next`/empty-next action is present, the option remains visible but renders disabled.

## Accessibility Notes

- Progress text uses `role="status"` and `aria-live="polite"`.
- Content sets `aria-busy` during async navigation work.
- Option buttons are keyboard-focusable with visible focus states.
- Option grids support arrow-key navigation (`←`, `→`, `↑`, `↓`, `Home`, `End`) between enabled options.
- Labels use safe text rendering.
- Question markup is rendered from sanitized authored content (no unsanitized HTML insertion).

## Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| Block shows "Configure quiz-router..." | No valid question/option rows | Add `question` row followed by `option` rows. |
| Option appears disabled | Destination URL is blocked by URL policy | Use a relative path or same-origin absolute URL, or use `#next`/empty URL for step advance. |
| Fragment not loading | Path not under `/fragments/` | Use `quizrouter-result-mode: fragment` and paths like `/fragments/name`. |
| Fragment does not render inline and page navigates | Fragment fetch failed or path is unavailable | Verify the fragment path is published and accessible as `.plain.html`. |
| Progress not visible | `quizrouter-progress` is false | Set `quizrouter-progress: true` in section metadata. |

## Bodea Rack Finder MLV

Recommended page path: `/rack-finder`

Recommended block order:
1. Intro copy (`text`)
2. Visual context (`circle-carousel`)
3. Guided flow (`quiz-router`)

### Copy-paste quiz-router table (6 questions)

```text
quiz-router
question | 1) Where will this rack/enclosure be deployed? | ![Deployment context](/images/quiz/rack-finder/q1-deployment.jpg)
option | Data closet / branch office || Quiet near-desk installs || Popular || 🏢 | #next
option | Small server room || 7-24U growth-ready footprint || Scalable || 🧰 | #next
option | Open office / retail backroom || Customer-facing and noise-sensitive || Retail || 🛍️ | #next
option | Industrial / warehouse edge | #next
question | 2) How many rack units (U) do you expect now? | ![Rack units guide](/images/quiz/rack-finder/q2-rack-units.jpg)
option | 1-6U (compact edge) | #next
option | 7-12U (growth ready) | #next
option | 13-24U (mid-scale) | #next
option | 25-42U (high capacity) | #next
option | I'm not sure yet | #next
question | 3) What is your highest priority? | ![Priority chooser](/images/quiz/rack-finder/q3-priority.jpg)
option | Quiet operation | #next
option | Maximum airflow | #next
option | Security / lockable access | #next
option | Easy installation | #next
question | 4) How dense is your cabling/network gear? | ![Cable density](/images/quiz/rack-finder/q4-cable-density.jpg)
option | Light (few devices) | #next
option | Moderate | #next
option | Dense | #next
option | Very dense / frequently changing | #next
question | 5) How quickly will you scale? | ![Growth planning](/images/quiz/rack-finder/q5-growth.jpg)
option | Stable for 12+ months | #next
option | Moderate growth in 6-12 months | #next
option | Aggressive growth in <6 months | #next
option | Unknown / planning phase | #next
question | 6) Pick your recommended starting shortlist | ![Recommended shortlist](/images/quiz/rack-finder/q6-recommendation.jpg)
option | Compact Edge (6U/12U shortlist) | /network-enclosures?filter=sku:BD-NE-06U-1,BD-NE-12U-GLASS-6U,BD-NE-12U-GLASS-12U&sort=position_DESC
option | Growth Ready (12U/24U shortlist) | /network-enclosures?filter=sku:BD-NE-12U-GLASS-12U,BD-NE-12U-GLASS-24U&sort=position_DESC
option | High Capacity (24U/42U shortlist) | /network-enclosures?filter=sku:BD-NE-12U-GLASS-24U,BD-NE-12U-GLASS-42U&sort=position_DESC
option | Compare All Enclosures | /network-enclosures?filter=sku:BD-NE-06U-1,BD-NE-12U-GLASS-6U,BD-NE-12U-GLASS-12U,BD-NE-12U-GLASS-24U,BD-NE-12U-GLASS-42U&sort=position_DESC
option | Start from Category View | /server-racks?sort=position_DESC
```

### Copy-paste section metadata

```text
section-metadata
quizrouter-progress | true
quizrouter-theme | premium
quizrouter-result-mode | navigate
```

### Copy-paste circle-carousel (responsive visual context)

```text
circle-carousel
![Server racks](/images/quiz/carousel/server-racks.jpg) | Server Racks -> /server-racks
![Network enclosures](/images/quiz/carousel/network-enclosures.jpg) | Network Enclosures -> /network-enclosures
![Power and cooling](/images/quiz/carousel/power-cooling.jpg) | Power & Cooling -> /power-cooling
![Cable management](/images/quiz/carousel/cable-management.jpg) | Cable Management -> /cable-management
![Accessories](/images/quiz/carousel/accessories.jpg) | Accessories -> /accessories
![Edge deployment](/images/quiz/carousel/edge-deployment.jpg) | Edge Deployment Guide -> /fragments/quiz/help/rack-units
```

### Suggested next pages/fragments to add

1. `/rack-finder` (main guided-selling page)
2. `/fragments/quiz/help/rack-units`
3. `/fragments/quiz/help/airflow`
4. `/fragments/quiz/help/cable-management`
5. `/fragments/quiz/help/security`

### Analytics events emitted by quiz-router

1. `quiz_start`: `quiz_id`, `quiz_version`, `entry_path`
2. `quiz_step_view`: `quiz_id`, `step_index`, `step_id`, `question_text`
3. `quiz_answer_select`: `quiz_id`, `step_id`, `option_id`, `option_label`, `next_action`
4. `quiz_complete`: `quiz_id`, `total_steps`, `completion_ms`, `result_route`
5. `quiz_result_click`: `quiz_id`, `result_id`, `destination_url`
6. `quiz_step_back`: `quiz_id`, `from_step_index`, `to_step_index`, `from_step_id`, `to_step_id`
7. `quiz_step_jump`: `quiz_id`, `from_step_index`, `to_step_index`, `from_step_id`, `to_step_id`
8. `quiz_restart`: `quiz_id`, `total_steps`

### Session-only state

- Saved in `sessionStorage` under `quizrouter:{quiz-id}:{sessionId}`
- Contains current step, max visited step, and selected option IDs
- Cleared when a completion route is selected

For direct copy/paste assets, use:
- `blocks/quiz-router/examples/rack-finder-quiz.table.txt`
- `blocks/quiz-router/examples/rack-finder-section-metadata.table.txt`
- `blocks/quiz-router/examples/rack-finder-circle-carousel.table.txt`
- `blocks/quiz-router/examples/rack-finder-next-pages.md`
