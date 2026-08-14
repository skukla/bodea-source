# Embed Block

## Overview

The Embed block displays third-party content (videos, social posts) inline on the page. It supports YouTube, Vimeo, Twitter, and generic iframe embeds. Embeds are loaded on demand for performance.

## Configuration

- **Content**: A link (`<a href="...">`) in the block defines the embed URL.
- **Autoplay**: Optional URL parameter or configuration can enable muted autoplay for video embeds.

## Integration

- **URL parameters**: YouTube/Vimeo URLs are detected by host (youtube, youtu.be, vimeo); other URLs use a default iframe embed.
- **Script loading**: Twitter embeds load `platform.twitter.com/widgets.js` when a Twitter URL is detected.

## Behavior

- Embeds are loaded when the block is ready; some providers (e.g. YouTube) use iframe with responsive 16:9 wrapper.
- Block is marked with `embed-is-loaded` after content is injected to avoid duplicate loads.

## Error Handling

- Invalid or unsupported URLs fall back to a generic iframe embed where possible.
- Script load failures for Twitter are not fatal; the block still renders the link.
