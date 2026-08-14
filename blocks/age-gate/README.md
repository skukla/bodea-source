# Age Gate Block

Full-screen date-of-birth verification overlay for age-restricted content.

## Overview

Shows a modal that requires users to enter their date of birth (MM/DD/YYYY). Calculates age and either grants access (18+ by default) or shows an error. Decision is persisted in `localStorage` and a cookie so the gate only appears once per browser.

## Configuration (DA.live key-value)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| data-min-age | number | 18 | Minimum age required |
| data-storage-duration | number | 30 | Days to remember the decision |
| data-title | text | Age Verification | Modal title |
| data-message | text | Please enter your date of birth... | Instruction text |
| data-month-placeholder | text | MM | Month input placeholder |
| data-day-placeholder | text | DD | Day input placeholder |
| data-year-placeholder | text | YYYY | Year input placeholder |
| data-button-text | text | Submit | Submit button label |
| data-error-message | text | You must be at least 18... | Error when underage |

## Behavior

- **Pass**: User enters valid DOB with age ≥ min → overlay dismisses, content visible
- **Fail**: User underage → error message shown, overlay stays
- **Invalid date**: "Please enter a valid date" error
- **Already verified**: If `age_gate_decision` in localStorage/cookie is `true`, block removes itself immediately

## Integration

- **Storage key**: `age_gate_decision` (localStorage + cookie)
- **Accessibility**: `role="dialog"`, `aria-modal`, focus trapping, Escape blocked
