---
id: routing
kind: foundation
atomic: —
spec: specs/Routing and Page State.md
frame: null
owns:
  - "The URL → page-state resolution: which archetype renders, which entry is active, what each surface shows"
  - "Hash and scroll-offset behavior on load and on navigation"
  - "Document title and meta composition per route"
  - "Unmatched-route handling"
does_not_own:
  - "The tree itself — see Content Model.md"
  - "How any surface looks in its active state — see each surface's own spec"
  - "Scroll-spy mechanics — see layout/TOC Column.md"
  - "Server, framework, or router implementation"
depends_on:
  - "Content Model.md (the tree)"
  - "pages/*.md (archetypes)"
  - "layout/TOC Column.md (scroll offset, scroll-spy)"
  - "layout/Sidebar Navigation.md (active + section treatment)"
  - "Pagination Footer.md (prev/next)"
states:
  - "matched docs route"
  - "matched marketing route (/)"
  - "matched route + hash"
  - "unmatched route"
a11y:
  - "Active nav item carries aria-current=\"page\"; active TOC item aria-current=\"location\""
  - "Route change moves focus to the content column's H1 and announces the new title"
tokens: [--ngpt-sys-layout-scroll-offset]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

# Routing and Page State

`Content Model.md` says what pages exist. This file says what a given URL *does* — the one function
every surface reads from.

## Resolution

Given a path, resolve in this order and stop at the first match:

| Order | Path | Result |
| --- | --- | --- |
| 1 | `/` | The `Home` archetype. Not a tree entry — see below. |
| 2 | Exact match on an entry's `slug` (including `hidden` entries) | That entry's archetype |
| 3 | Anything else | The `Not Found` archetype |

Matching is exact, case-sensitive, and ignores a trailing slash. Query strings and hashes are stripped
before matching. There is no prefix matching and no redirect table: a section is not a route, so
`/docs/state-layer` does not resolve unless an entry declares that exact slug.

Every docs slug begins `/docs` (`Content Model.md` owns that rule), so the zone test is mechanical —
under `/docs` means the docs shell, outside it means a marketing page. But the prefix does **not** make
`/docs/anything` resolve: step 2 is still an exact match against a declared entry, and an unmatched path
under `/docs` gets `Not Found` like any other.

## Page state

One resolved entry produces this, and every surface reads it rather than computing its own:

| Field | Value |
| --- | --- |
| `archetype` | The entry's `archetype`, or `Home` / `Not Found` |
| `entry` | The matched entry, or `null` |
| `section` | The entry's parent section, or `null` for the root entry |
| `eyebrow` | `entry.eyebrow ?? section.label`, or `null` for the root entry, which has no section and no `eyebrow` of its own — the `category-badge` text |
| `h1` | `entry.label`, always. Never worded differently from the nav item. |
| `prev` / `next` | The adjacent visible entries in flattened tree order, either possibly `null` |
| `headings` | The H2/H3s of the rendered content, in document order |
| `title` | See below |

## Per-surface consequences

| Surface | Matched docs route | `/` | Unmatched |
| --- | --- | --- | --- |
| `sidebar` | Full tree. The matched entry is `is-active` + `aria-current="page"`; its parent section reads as current. | Absent | Full tree, nothing active |
| `toc` | `headings` of this entry; scroll-spy owns which is active | Absent | Absent |
| `pagination` | `prev` / `next`, each side omitted when `null` | Absent | Absent |
| `navbar` | Docs treatment, sticky | Band treatment — see `pages/Home.md` | Docs treatment |
| `category-badge` | `eyebrow` | Section eyebrows only | Absent |

**A `null` eyebrow renders nothing.** The root entry (`/docs`) has no parent section, so unless it declares
its own `eyebrow` the `category-badge` is omitted and the H1 sits at the top of the column. An eyebrow
reading "Docs" or "Overview" would only restate the H1 below it.

Exactly one entry is active at a time, or none. Two active items means a surface hand-authored its
state instead of reading this one — see `Content Model.md`.

## Hash behavior

A hash never changes which entry is active. It only positions the scroll and the TOC's own active item.

- On load with a hash, jump — do not smooth-scroll — to the target heading, offset by
  `--ngpt-sys-layout-scroll-offset` (72px) so the sticky navbar does not cover it. Smooth scrolling on
  first paint reads as a bug.
- On in-page navigation (a TOC click), smooth-scroll to the same offset and push the hash without a
  reload.
- A hash that matches no heading on the page is ignored: render the page at the top, leave the URL
  alone, and do **not** fall through to `Not Found` — the page exists, the anchor does not.
- Changing only the hash must not re-render the article or reset the sidebar.

## Document title

| Route | Title |
| --- | --- |
| `/` | The product name and its one-line positioning |
| A docs entry | `{entry.label} · {section.label} · NGP Table`, and `{entry.label} · NGP Table` for the root entry, which has no section |
| Unmatched | A not-found phrase plus the product name |

Composed from `label` and the section, never authored per page. Same source as the H1, so they can
never disagree.

## Route change

A client-side route change is not a page load, so three things must be done explicitly:

1. Reset scroll to the top of the content column — unless the new URL carries a hash.
2. Move focus to the content column's H1 so keyboard and screen-reader users land in the new content
   rather than back at the top of the sidebar.
3. Update the title before focus moves, so the announcement carries the new page's name.

## Sitemap

`hidden` entries are **excluded from the sitemap** as well as from the sidebar (decided 2026-08-22). They
stay routable and stay indexed by the in-site search, which is what `hidden` is for: reachable by link
and by search, not advertised. Listing them in the sitemap would advertise them to crawlers, which is the
one audience that cannot be told they are unlisted.

## Open

- Trailing-slash handling is specified as "ignored" — whether the canonical form redirects is a
  deployment choice, not a design one.
