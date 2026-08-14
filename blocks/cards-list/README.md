# Cards List Block

## Overview

The `cards-list` block styles a simple list of authored cards into a consistent card grid presentation.
It applies semantic classes to direct child rows and converts inline links into button-style CTAs.

## Integration

### Block Configuration

This block does not use `readBlockConfig()` and has no config keys.

### URL Parameters

None.

### Local Storage

None.

### Events

This block does not emit or subscribe to runtime events.

## Behavior Patterns

### Page Context Detection

- Works in any page context where a `cards-list` block is authored.

### User Interaction Flows

1. Author adds rows/cells with optional links in DA content.
2. On decorate:
- each top-level row receives `card-item`
- the first paragraph in the row's second cell receives `desc`
- all links are styled as `button alt`

### Error Handling

- Defensive null checks prevent failures when optional cells/paragraphs are missing.
- If structure differs from expected shape, block still renders without throwing.
