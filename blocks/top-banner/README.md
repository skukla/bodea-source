# Top Banner Block

## Name of Block and Purpose

The **Top Banner** block renders a global information strip that stays above the fixed site navigation.

It supports:
- static announcement mode,
- ticker mode for rotating message text,
- optional right-side utility links,
- optional ticker pause/play control,
- optional dismiss behavior with session/local persistence,
- section metadata configuration for styling and behavior.

## Benefits

- Gives Solutions Consultants a reusable global announcement pattern for promotions, shipping notes, legal notices, and campaign utilities.
- Works above the fixed nav to preserve visibility.
- Token-first styling with safe metadata fallbacks.
- Reduced-motion safe ticker behavior.

## How to Author

Create a 3-column `top-banner` table.

| Column | Purpose | Required | Notes |
|---|---|---|---|
| 1 | Primary announcement message | Yes | In `ticker` mode, this is included in the scrolling stream. |
| 2 | Optional center utility content | No | Used in `multi` layout and included in ticker when `data-ticker-source=all`. |
| 3 | Optional right utility links/content | No | Used in `split` and `multi`; included in ticker when source includes right content. |

Example:

| top-banner | | |
|---|---|---|
| Enjoy a limited-time welcome offer. Terms apply. |  | Track Order\|/orders |

Ticker example (multiple rows):

| top-banner | | |
|---|---|---|
| Free shipping on qualifying orders |  | Track Order\|/orders |
| New collection now available |  | Choose Region/Currency |
| Limited-time promotion ends soon |  |  |

## How to Section-Metadata

Place **Section Metadata immediately above** the `top-banner` block.

| Section Metadata | Value |
|---|---|
| `data-banner-mode` | `ticker` |
| `data-banner-mount` | `header` |
| `data-banner-mount-target` | `header .header.block` |
| `data-banner-layout` | `split` |
| `data-banner-aria-live` | `off` |
| `data-banner-align` | `center` |
| `data-banner-variant` | `promo` |
| `data-banner-dismissible` | `true` |
| `data-banner-dismiss-scope` | `session` |
| `data-banner-max-width` | `1400` |
| `data-banner-text-size` | `md` |
| `data-banner-text-weight` | `500` |
| `data-banner-density` | `compact` |
| `data-banner-content-gap` | `small` |
| `data-banner-bg-color` | `light` |
| `data-banner-text-color` | `dark` |
| `data-ticker-speed` | `medium` |
| `data-ticker-direction` | `left` |
| `data-ticker-pause-on-hover` | `true` |
| `data-ticker-loop-gap` | `medium` |
| `data-ticker-source` | `all` |
| `data-ticker-controls` | `true` |
| `data-ticker-mobile-mode` | `static` |
| `data-banner-region` | `global` |
| `data-banner-audience` | `all` |
| `data-banner-analytics-id` | `spring-promo-banner` |

## Accessibility

- Uses a semantic region with label (`Site announcement`).
- Dismiss control is keyboard accessible and focus-visible.
- Ticker pauses on hover/focus when enabled.
- Ticker motion is disabled under `prefers-reduced-motion`.

## Troubleshooting

- **Banner not showing above nav**: verify `/top-banner` exists and contains a `top-banner` block.
- **Ticker not moving**: check `data-banner-mode=ticker`, ensure content exists in the source lanes, and verify `prefers-reduced-motion` is not forcing static fallback.
- **Ticker not moving on mobile**: verify `data-ticker-mobile-mode`. Default is `static` for mobile-friendly motion safety.
- **Right-side content is not scrolling in ticker**: use `data-ticker-source=all` (default) or `left-right` to include right-lane content in the ticker stream.
- **Dismiss not persisting**: verify `data-banner-dismiss-scope` is `session` or `local`.
- **Metadata not applying**: ensure Section Metadata is directly above the block.
- **I used `data-banner-layout=center`**: this is treated as a compatibility alias for `data-banner-layout=split` with `data-banner-align=center`. Prefer `data-banner-align` directly.

## Section Metadata Reference

| Key | Default | Possible Values | Effect |
|---|---|---|---|
| `data-banner-mode` | `static` | `static`, `ticker` | Chooses static message rendering or animated ticker rendering for column-1 rows. |
| `data-banner-mount` | `header` | `header` | Controls mounting strategy. `header` self-mounts and self-offsets for portability. |
| `data-banner-mount-target` | `header .header.block` | CSS selector | Target used when `data-banner-mount=header`. |
| `data-banner-layout` | `split` | `single`, `split`, `multi` | Controls lane layout for static mode: message only, message + right, or message + center + right. |
| `data-banner-aria-live` | `off` | `off`, `polite` | Controls assistive announcement behavior. Use `polite` only when content updates should be announced. |
| `data-banner-align` | `left` | `left`, `center`, `right` | Aligns the primary message lane. In `split` + `center`, the message is centered while right utility content remains right-aligned. |
| `data-banner-variant` | `neutral` | `info`, `promo`, `urgent`, `neutral` | Applies semantic visual variant intent for campaign/priority styling. |
| `data-banner-dismissible` | `false` | `true`, `false`, `1`, `0`, `yes`, `no`, `on`, `off` | Shows dismiss button and allows user dismissal state. |
| `data-banner-dismiss-scope` | `session` | `session`, `local`, `none` | Controls persistence duration for dismiss action. |
| `data-banner-max-width` | `none` | `none`, `1200`, `1400`, `1600` | Constrains inner content width while banner background remains full-width. |
| `data-banner-text-size` | `md` | `sm`, `md`, `lg` | Sets global banner typography size preset. |
| `data-banner-text-weight` | `500` | `400`, `500`, `600`, `700` | Sets global banner typography weight. |
| `data-banner-density` | `default` | `default`, `compact` | Controls vertical density of the banner. `compact` reduces banner height and perceived page gap while preserving fixed-offset behavior. |
| `data-banner-content-gap` | `none` | `none`, `xsmall`, `small`, `medium`, `large` | Adds extra spacing below fixed header stack in portable `data-banner-mount=header` mode, without touching specific content blocks. |
| `data-banner-bg-color` | `neutral` | `transparent`, `light`, `neutral`, `dark`, `brand`, `accent`, `white`, `black`, `#RGB`, `#RRGGBB`, `rgb(...)`, `rgba(...)` | Sets banner surface color. |
| `data-banner-bg-colour` | same as above | alias of `data-banner-bg-color` | UK spelling alias for background color. |
| `data-banner-text-color` | `dark` | `transparent`, `light`, `neutral`, `dark`, `brand`, `accent`, `white`, `black`, `#RGB`, `#RRGGBB`, `rgb(...)`, `rgba(...)` | Sets banner text/link color. |
| `data-banner-text-colour` | same as above | alias of `data-banner-text-color` | UK spelling alias for text color. |
| `data-ticker-speed` | `medium` | `slow`, `medium`, `fast` | Controls ticker animation speed. |
| `data-ticker-direction` | `left` | `left`, `right` | Controls ticker scroll direction. |
| `data-ticker-pause-on-hover` | `true` | `true`, `false`, `1`, `0`, `yes`, `no`, `on`, `off` | Pauses ticker motion while hovered/focused. |
| `data-ticker-loop-gap` | `medium` | `small`, `medium`, `large` | Controls spacing between ticker items in the scrolling sequence. |
| `data-ticker-source` | `all` | `all`, `left`, `left-right` | Selects which authored columns feed ticker content. `all` includes left/center/right cells in row order. |
| `data-ticker-controls` | `false` | `true`, `false`, `1`, `0`, `yes`, `no`, `on`, `off` | Shows a Pause/Play control for ticker motion. |
| `data-ticker-mobile-mode` | `static` | `static`, `ticker` | Controls ticker behavior on mobile widths; `static` favors readability by disabling animation. |
| `data-banner-region` | `global` | `global`, `emea`, `na`, `apac` | Region targeting metadata hook for consulting demos and integrations. |
| `data-banner-audience` | `all` | `all`, `guest`, `signed-in`, `vip` | Audience targeting metadata hook for demo scenarios. |
| `data-banner-analytics-id` | empty | free text | Optional analytics identifier for campaign tracking instrumentation. |

## Runtime Events

The block emits custom events on the block element:

- `top-banner:shown`
- `top-banner:ticker-start`
- `top-banner:dismissed`

## Quick Validation

Use this in browser console to validate runtime state quickly:

```js
(() => {
  const banner = document.querySelector('.top-banner');
  const ticker = banner?.querySelector('.top-banner-ticker');
  const track = ticker?.querySelector('.top-banner-ticker-track');
  console.table({
    mode: banner?.dataset.bannerMode,
    effectiveLayout: banner?.dataset.bannerEffectiveLayout,
    direction: ticker?.dataset.direction,
    source: ticker?.dataset.source,
    controls: banner?.dataset.bannerTickerControls,
    mobileMode: banner?.dataset.bannerTickerMobileMode,
    ariaLive: banner?.getAttribute('aria-live'),
    items: ticker?.querySelectorAll('.top-banner-ticker-item').length ?? 0,
    animation: track ? getComputedStyle(track).animationName : '(none)',
  });
})();
```
