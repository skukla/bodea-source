# Video Block

## Overview

The Video block embeds videos from YouTube, Vimeo, or self-hosted sources. It supports optional poster-image placeholders, autoplay, and background (looping/muted) modes. Videos are lazy-loaded via `IntersectionObserver` for performance.

## Integration

### Block Configuration

- The block expects an `<a>` link to the video URL in its authored content
- An optional `<picture>` element serves as a click-to-play poster image

### Block Variants

- **Default**: Shows poster image with play button; loads embed on click
- **autoplay** (class): Auto-loads and plays the video when it scrolls into view; no poster interaction needed
- **background** (via autoplay): Loops muted with no controls, suitable for ambient backgrounds

### Supported Platforms

| Platform | Detection | Embed Method |
|----------|-----------|--------------|
| YouTube | `youtube` or `youtu.be` in URL | iframe with `/embed/` |
| Vimeo | `vimeo` in URL | iframe via `player.vimeo.com` |
| Self-hosted | Any other URL | Native `<video>` element |

## Behavior Patterns

### User Interaction Flows

1. **With poster**: Block shows the image with a centered play button; clicking loads and plays the video
2. **Without poster / autoplay**: An `IntersectionObserver` triggers the embed when the block enters the viewport
3. **Background mode**: Video loops muted with controls hidden and `playsinline` for mobile

### Visual Details

- Videos and iframes get rounded corners (24px) with glassmorphic border and layered shadow
- Play button is a circular glassmorphic element that scales and glows purple on hover
- Poster images fill the 16:9 placeholder with `object-fit: cover`

### Loading States

- `data-embed-loaded="false"`: Placeholder visible, embed hidden (maintains 16:9 aspect ratio)
- `data-embed-loaded="true"`: Embed visible, placeholder hidden

### Error Handling

- `prefers-reduced-motion`: Autoplay is suppressed; video loads but does not auto-play
- Duplicate loads are prevented by checking `data-embed-loaded` before embedding
- Self-hosted videos wait for `canplay` event before marking as loaded
