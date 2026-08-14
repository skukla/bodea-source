# Bodea Brand Source

Brand source repo for the **Bodea** demo, consumed by
[Demo Builder](https://github.com/skukla/demo-builder-vscode). It holds:

- **Custom blocks** (`blocks/`) — the Bodea block library.
- **`styles/bodea-theme.css`** — the additive brand stylesheet (editorial
  green / ink / gold), loaded after `styles.css`.
- **`scripts/bodea-customer-group.js`** — additive customer-group Catalog
  Service context module (sets the `Magento-Customer-Group` header on
  sign-in; no commerce.js patch).
- **DA content site** — content mounts from
  `https://content.da.live/skukla/bodea-source/` (see `fstab.yaml`), so this
  repo publishes its own doc/demo pages.

## What this repo is NOT

**Not a template.** Never generate storefronts from it. Storefronts come from
[adobe-commerce/boilerplate-b2b-template](https://github.com/adobe-commerce/boilerplate-b2b-template);
this repo only supplies brand assets on top of that generation.

## How blocks and assets reach users

- Blocks ship through the **bodea-blocks block library** (selected in the
  Demo Builder wizard).
- `bodea-theme.css` and `bodea-customer-group.js` ship through the Demo
  Builder **brand-assets vendor point**, which fetches them from this repo and
  wires them into the generated storefront's `head.html`.

## CI guards (`.github/workflows/brand-source-ci.yml`)

- **Dropin import-map check** (`scripts/check-dropin-imports.mjs`): every
  `@dropins/*` import in `blocks/**` and `scripts/bodea-*.js` must resolve in
  the import map of the b2b **last-known-good** boilerplate ref (from
  `skukla/eds-demo-patches`). Red = a block depends on a dropin the pinned
  template generation does not vendor = no merge.
- **Tenant-leak grep**: this repo is public; tenant identifiers and API keys
  fail CI.
- **Lint**: the boilerplate's eslint + stylelint.

## Preview

Pages publish at `https://main--bodea-source--skukla.aem.live/<path>`
(preview: `https://main--bodea-source--skukla.aem.page/<path>`).
