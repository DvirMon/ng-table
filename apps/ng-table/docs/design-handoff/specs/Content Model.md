---
id: content-model
kind: foundation
atomic: —
spec: specs/Content Model.md
frame: null
owns:
  - "The nav tree: sections, their order, their entries, and each entry's label / slug / archetype"
  - "The rule that sidebar, TOC, pagination, search, and active state all derive from this tree"
  - "Entry field definitions and slug rules"
does_not_own:
  - "How any of those five surfaces look — see their own specs"
  - "The prose inside a page (authored per route)"
  - "Which heading levels a TOC shows — see layout/TOC Column.md"
depends_on:
  - "pages/*.md (archetype names)"
states: []
a11y: []
tokens: []
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

# Content Model

The site's page list, in order, in one place.

Five specced surfaces are all views of this one structure. None of them may be hand-authored per page:

| Surface | What it derives |
| --- | --- |
| `sidebar` | Sections and their entries, in tree order |
| `toc` | Headings of the current entry only |
| `pagination` | Prev/next = the entries either side of the current one, in flattened tree order |
| `search` | Result groups = sections; result items = entries |
| active state | Which `nav-item` is active, which section reads as current |

If two of these ever disagree at runtime, one of them was hand-authored. That is the bug.

## Shape

The tree is an ordered list of sections. Each section is an ordered list of entries. Two levels, no deeper — the sidebar has no expand/collapse affordance, so a third level has nowhere to render.

```
tree:
  - section: "<label>"           # uppercase treatment is presentational, not stored
    entries:
      - label: "<nav + H1 text>"
        slug: "/<path>"
        archetype: "Doc Article" | "Section Landing" | "API Reference" | "Examples Gallery"
```

One entry may sit outside any section (the docs root, "Overview"). It renders above the first section label.

## Slug prefix

Every entry in the tree lives under `/docs`. The docs root is `/docs` itself; everything else is
`/docs/<section>/<entry>`.

The site has two zones — a marketing page at `/` and the docs — and the prefix is what keeps them from
colliding. A future `/pricing` or `/blog` can never shadow a docs slug, and the zone test stays
mechanical: paths under `/docs` get the docs shell, paths outside it do not. No lookup, no exception for
the root.

The cost is longer URLs. Accepted.

## Entry fields

| Field | Required | Rule |
| --- | --- | --- |
| `label` | yes | Single source for three things: the sidebar item, the page H1, and the pagination card. They are never worded differently. |
| `slug` | yes | Absolute, leading slash, no trailing slash, lowercase, hyphenated. **Every docs entry begins `/docs`** — see the prefix rule above. The route, and the anchor-free part of every link to this page. |
| `archetype` | yes | Must name a file in `specs/pages/`. Determines the page's slot composition. |
| `eyebrow` | no | Overrides the `category-badge` text. Defaults to the parent section's label — see `pages/Doc Article.md`. |
| `hidden` | no | Excluded from the sidebar but still routable and still indexed. Use sparingly. |

`Not Found` is an archetype but never an entry — it has no slug and no place in the order.

## Order

Tree order is the only order. Flatten the tree top to bottom to get the reading sequence that `pagination` walks.

- Prev/next cross section boundaries. The last entry of one section is followed by the first entry of the next.
- The first entry has no prev; the last has no next. `pagination` omits the missing side.
- `hidden` entries are skipped when walking prev/next.
- Sections are not themselves navigable targets. A section label is a heading, not a link.
- A section whose entries are all `hidden`, or which has none, renders nothing at all — no label above an
  empty group. `layout/Sidebar Navigation.md` owns that.

## Active state

Exactly one entry is active at a time, resolved by exact `slug` match against the current path.
`Routing and Page State.md` owns that resolution and the full per-surface consequence table; this file
owns only the tree it reads.

- That entry's `nav-item` carries `is-active` and `aria-current="page"`.
- Its parent section reads as current. Whether that means the `--accent` nav-item variant is per-page — `pages/Doc Article.md` sets it.
- On an unmatched path, nothing is active, and the page is `Not Found`.
- A `#hash` in the URL never changes which entry is active; it only moves the TOC's own active item.

## Seed tree

Evidenced by the reference frames — **incomplete**. The full page list is authored content, not design. Fill it in before building; do not infer the remainder.

```
- label: "Overview"
  slug: "/docs"
  archetype: "Section Landing"

- section: "1. State Layer"
  entries:
    - label: "Architecture"    slug: "/docs/state-layer/architecture"    archetype: "Doc Article"
    - label: "PRD"             slug: "/docs/state-layer/prd"             archetype: "Doc Article"

- section: "3. UI Layer"
  entries:
    - label: "Sorting"         slug: "/docs/ui-layer/sorting"            archetype: "Doc Article"
```

Sections 2 and 4+ are referenced by the numbering but their entries are unknown.

The frames show a pagination card reading "State Layer Architecture", which is a *composed* string
(section + label). **Resolved 2026-08-22: the card shows `label` alone.** `label` is the single source for
the sidebar item, the H1 and the card, and they are never worded differently — a composed card title
re-introduces exactly the drift this file exists to prevent. See `Pagination Footer.md` § Build spec.

## Open

- Where the tree physically lives (a JSON/YAML file, front-matter across content files, or a generated manifest) is an implementation choice this spec does not make. It only requires that there be exactly one.
- ~~The seed tree is inconsistent about prefixes~~ **resolved 2026-08-21:** every docs entry lives under
  `/docs` — see the prefix rule above.
- ~~Whether the home page is `/` with the `Section Landing` archetype, or a separate marketing page~~ **resolved 2026-08-21:** `/` is a marketing page with no sidebar — see `pages/Home.md`. It is **not** in the tree, so the first tree entry is the docs root (`/docs`, "Overview"). Home never appears in prev/next and is never the active nav item.
