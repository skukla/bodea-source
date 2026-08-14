# Age Verification Block

Simple Yes/No age confirmation overlay.

## Overview

Shows a modal with a question and two buttons. "Yes" grants access and dismisses; "No" redirects to a configurable URL. Decision is stored in `localStorage` so the prompt only appears once per browser.

## Configuration (DA.live key-value)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| title | text | Are you 18 or older? | Question text |
| yes-text | text | Yes | Yes button label |
| no-text | text | No | No button label |
| redirect-url | text | https://www.google.com | Where to send users who click No |

## Behavior

- **Yes**: Sets `age_verified` in localStorage, removes overlay, content visible
- **No**: Redirects to `redirect-url` (e.g. Google or a safe-exit page)
- **Already verified**: If `age_verified` in localStorage is `true`, block removes itself immediately

## Integration

- **Storage key**: `age_verified` (localStorage)
- **Accessibility**: `role="dialog"`, `aria-modal`, focus trapping
