# VIP Hero

## Overview

`vip-hero` is a Commerce-segment-driven EDS hero for VIP promotional use cases.

It keeps the split of responsibility explicit:

- AEM owns the authored story shell and per-state copy.
- Adobe Commerce owns qualification through customer-segment membership exposed by storefront personalization.
- Winter Gear PLP/PDP pages remain the source of truth for live price and promo badge confirmation.

## Runtime States

The block resolves four runtime states:

- `pending`: neutral shell shown while Commerce personalization has not been observed for the session.
- `anonymous`: shopper is not authenticated.
- `qualified`: authenticated shopper matches the authored Commerce segment.
- `non-qualified`: authenticated shopper does not match the authored Commerce segment.

If `fallbackMode=hide`, the block suppresses the non-qualified state entirely.

## Authoring Contract

Configure the block as a DA key-value block using these fields:

- `media_image`, `media_imageAlt`
- `qualified_eyebrow`, `qualified_headline`, `qualified_body`, `qualified_ctaHref`, `qualified_ctaText`, `qualified_secondaryCtaHref`, `qualified_secondaryCtaText`, `qualified_proof1`, `qualified_proof2`, `qualified_proof3`, `qualified_disclaimer`
- `anonymous_eyebrow`, `anonymous_headline`, `anonymous_body`, `anonymous_ctaHref`, `anonymous_ctaText`, `anonymous_secondaryCtaHref`, `anonymous_secondaryCtaText`, `anonymous_proof1`, `anonymous_proof2`, `anonymous_proof3`, `anonymous_disclaimer`
- `fallback_eyebrow`, `fallback_headline`, `fallback_body`, `fallback_ctaHref`, `fallback_ctaText`, `fallback_secondaryCtaHref`, `fallback_secondaryCtaText`, `fallback_proof1`, `fallback_proof2`, `fallback_proof3`, `fallback_disclaimer`
- `pending_eyebrow`, `pending_headline`, `pending_body`, `pending_disclaimer`
- `audienceKey`, `promoRuleId`, `fallbackMode`, `classes`

### Field Semantics

- `audienceKey`: exact Commerce customer-segment identifier used for eligibility matching.
- `promoRuleId`: analytics and demo metadata only. The block never uses it for qualification.
- `fallbackMode`: `seasonal` or `hide`.
- `classes`: restricted layout bundle. Allowed values:
  - `vip-winter split-left with-proof-bar`
  - `vip-winter overlay-right with-proof-bar`
  - `vip-winter split-left`

## Eligibility Resolution

The block resolves qualification from the same personalization runtime used elsewhere in the repo:

1. `authenticated` from the event bus
2. `segments` from `getPersonalizationData()`
3. `audienceKey` base64-encoded before matching against runtime segment `uid` values

The block does not infer qualification from local copy, URL parameters, or authored fallback state.

## Analytics

The block pushes Adobe Client Data Layer events for:

- `vip-hero-state`
- `vip-hero-impression`
- `vip-hero-cta-click`

Each payload includes:

- `blockId`
- `resolvedState`
- `audienceKey`
- `promoRuleId`
- `experimentId`
- `ctaSlot`
- `href`

## Notes

- The hero intentionally avoids hardcoding live numeric discount values.
- The destination Winter Gear shopping pages validate actual discount amount, badge, and price.
- The block is intended to live in its own section so `fallbackMode=hide` can suppress the full section cleanly.
