# Blog Post

Renders a full blog article with header, hero image, author metadata, body content, and an auto-generated table of contents sidebar.

## Configuration

All options are set via **section-metadata** or block data attributes. The block reads header content (title, description, image, author, category, tags, publishdate) from **page metadata**.

| Option | Values | Default | Description |
|---|---|---|---|
| `blogpost-layout` | `classic`, `centered`, `magazine`, `splitcover` | `classic` | Controls the overall page layout |
| `blogpost-style` | `editorial`, `minimal` | `editorial` | Typography and spacing style |
| `blogpost-width` | `default`, `wide` | `default` | Max-width of the content area |
| `blogpost-showhero` | `true`, `false` | `true` | Show/hide the hero image |
| `blogpost-heroratio` | `wide`, `landscape`, `square` | `wide` | Aspect ratio (16:9, 4:3, 1:1) |
| `blogpost-showdescription` | `true`, `false` | `true` | Show/hide the description subtitle |
| `blogpost-showmeta` | `true`, `false` | `true` | Show/hide author name, avatar, and publish date |
| `blogpost-showtoc` | `true`, `false` | `true` | Show/hide the table of contents sidebar |

## Page Metadata

The block reads these fields from the page's `<meta>` tags:

- `title` -- Article headline (falls back to `og:title` then `document.title`)
- `description` -- Subtitle/summary text
- `image` -- Hero image URL (also reads `og:image`)
- `author` -- Author display name
- `authorimage` -- Author avatar image URL
- `category` -- Category label shown above the title
- `tags` -- Comma-separated tag list
- `publishdate` -- Publish date in `YYYY-MM-DD` format

## Table of Contents

The TOC is auto-generated from `h2`, `h3`, and `h4` headings in the body content. On desktop (1024px+) it renders as a sticky sidebar with scroll tracking and a progress bar. On mobile it collapses with a toggle button. Disable it with `blogpost-showtoc: false`.

## Layouts

- **Classic** -- Linear flow: header, hero, body + TOC sidebar
- **Centered** -- Header and body centered, TOC above body
- **Magazine** -- Two-column header (text left, hero right), body below
- **Split Cover** -- Equal two-column header with rounded hero, body below
