---
id: search-index
kind: foundation
atomic: —
spec: specs/Search Index.md
frame: null
owns:
  - "What gets indexed, at what granularity"
  - "The record shape a result row renders from"
  - "Group derivation and group order"
  - "Match, rank, and highlight rules"
  - "What selecting a result does"
does_not_own:
  - "Any search UI — see Search.md"
  - "The tree itself — see Content Model.md"
  - "Route resolution — see Routing and Page State.md"
  - "Choice of search library, or whether the index is built or bundled"
depends_on:
  - "Content Model.md (entries, sections, order)"
  - "Content Prose.md (heading levels)"
  - "Search.md (the surfaces that render these records)"
states: []
a11y:
  - "Result count changes are announced by Search.md's live region; this spec only guarantees the count is knowable before render"
tokens: []
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

# Search Index

`Search.md` specs the field, the overlay and every visual state. It explicitly does not own indexing.
This file closes that half: what is searched, what a result *is*, and what happens on select.

## Granularity: one record per heading

The unit is **a heading and the prose beneath it**, not a page. A docs page with six H2s produces seven
records — one for the page itself, one per heading.

Page-level records make a table of contents, not a search: a query matching deep inside a long article
returns the article, and the reader has to find the passage again by eye. Heading-level records land
them on the passage.

H2 and H3 only, matching the TOC. H4 is not indexed — `layout/TOC Column.md` already excludes it as too
deep to label, and it is too granular to rank meaningfully.

## Record shape

| Field | Source | Used for |
| --- | --- | --- |
| `id` | `slug` + `#anchor`, or `slug` for a page record | Row key; the navigation target |
| `title` | The heading text, or `entry.label` for a page record | Result row title |
| `section` | The entry's parent section label | Group assignment |
| `breadcrumb` | `section.label › entry.label › heading` — heading omitted on a page record | The row's second line |
| `body` | Prose under the heading, down to the next heading of any level | Matching only, never displayed |
| `entryOrder` | The entry's flattened tree position | Tie-breaking |

## What is indexed

**Indexed:** headings, body prose, list items, table cell text, callout body, and inline code spans —
an identifier like `ngpTableSort` is often exactly what someone searches for.

**Not indexed:** code block contents, `Preview Window` demo markup, the nav tree's own labels, and the
marketing page. Code blocks are the sharpest call: they are mostly boilerplate and imports, and
indexing them buries prose results under near-identical snippets. Inline code carries the identifiers
worth finding.

Home is excluded because its copy is positioning, not documentation. A reader searching "sorting" wants
the sorting page, not the hero line that mentions it.

## Groups

A group is a **section of the nav tree**. Group labels are section labels; group order follows tree
order, never match score — a stable, learnable order beats a marginally better one that reshuffles as
you type. The root entry, which has no section, groups under its own label.

Groups with no matches are omitted entirely rather than shown empty.

## Matching and ranking

Prefix and substring matching on whole words, case-insensitive, diacritic-insensitive. No fuzzy
matching: on a corpus this small it produces confident wrong answers, and the reader cannot tell why a
result appeared.

Rank within a group:

1. Title matches above body matches.
2. A match at the start of a title above a match inside it.
3. Page records above heading records of the same entry.
4. `entryOrder` ascending — deterministic, so the same query always gives the same order.

Highlight only the matched run, in the title, using the color-only treatment in `Search.md`. Body text
is never shown, so it is never highlighted.

Cap at 8 results per group and 30 overall. Beyond that the list stops being scannable, and a query that
broad needs refining rather than paging.

## Selecting a result

Navigate to `record.id`. A heading record therefore lands on the page *and* at the anchor, offset by
`--ngpt-sys-layout-scroll-offset` per `Routing and Page State.md`. Same-page selection is a hash change,
not a re-render.

## Recent searches

`Search.md`'s empty state shows recent searches. Store the **query strings**, not results — up to 5,
most recent first, deduplicated, local to the browser. Storing records would let them go stale against
a rebuilt index and point at anchors that no longer exist.

## Open

- Whether the index is built at compile time or assembled in the browser is an implementation choice.
  This spec only requires that the record count is knowable before first render, so the live region can
  announce it.
- Whether a synonym list is worth it for a few known pairs (e.g. "a11y" / "accessibility"). Deferred
  until the page list is complete.
