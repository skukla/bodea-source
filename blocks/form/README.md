# Form

Renders a dynamic form from a JSON definition, with client-side validation and POST submission to a configurable endpoint.

## Configuration

The block reads two rows from the authored table:

| Row | Purpose | Description |
|-----|---------|-------------|
| 1 | Form definition URL | URL to a JSON file that describes the form fields |
| 2 | Submit endpoint URL | Webhook or API endpoint that receives the form data as a JSON POST |

Both URLs should be pasted as plain text (not hyperlinks) to avoid EDS link rewriting.

## DA.live Model Fields

| Field | Type | Description |
|-------|------|-------------|
| `formUrl` | text | Full URL to the form definition JSON |
| `submitUrl` | text | Webhook or API endpoint for submissions |

## Behavior

1. On load, the block fetches the form definition JSON from the configured URL.
2. Fields are built dynamically based on the JSON schema (supports both legacy capitalized keys and modern lowercase keys).
3. On submit, the form data is collected into a JSON payload and POSTed to the submit endpoint.
4. The block shows loading, success, and error states with visible feedback messages.
5. If a `confirmation` URL is set in the form dataset, the user is redirected after successful submission.

## Supported Field Types

`text`, `email`, `tel`, `number`, `url`, `password`, `date`, `textarea`, `select`, `checkbox`, `radio`, `submit`, `reset`, `hidden`

## Error Handling

- If the form definition URL fails to load, an error message is displayed in the block.
- Client-side validation runs on submit using the Constraint Validation API.
- POST failures show an error message with the HTTP status or network error details.
- The block attempts multiple submission strategies (wrapped and raw payloads) before reporting failure.

## URL Resolution

The block includes logic to handle EDS link rewriting by preferring the visible text content of anchor tags over their `href` attribute when the text is a valid absolute URL. DA.live sheet URLs are also normalized automatically.
